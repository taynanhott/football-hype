import {
  pendingFixtures,
  scheduledBatches,
  clubCalendarRoutine,
  gameDayStart,
} from '@football/domain';
import { create } from 'zustand';
import { z } from 'zod';
import { Client } from 'colyseus.js';
import { connectWorker, type GameRoom } from './worker-transport';
import {
  commandSchema,
  gameSnapshotSchema,
  gameSnapshotUpdateSchema,
  snapshotDeltaSchema,
  applyStateChanges,
  ledgerEntrySchema,
  type GameCommand,
  type GameSnapshot,
} from '@football/shared';
import { credentials, serverUrl } from '../features/leagues/api';
import { ActionQueue, type PendingAction } from './action-queue';
import { localTables } from './local-tables';
import { loadSnapshotCache, saveSnapshotCache, prepareSnapshotManifest } from './snapshot-cache';

const pendingActionSchema = z.object({
  id: z.uuid(),
  command: commandSchema,
  at: z.number().nonnegative(),
  sent: z.boolean(),
  revision: z.number().int().nonnegative().optional(),
});

type GameStore = {
  snapshot: GameSnapshot | null;
  clockOffset: number;
  room: GameRoom | null;
  userId: string;
  connected: boolean;
  busy: boolean;
  loadingMessage: string | null;
  loadingActivity: 'travel' | 'training' | 'calendar' | null;
  pendingActions: number;
  confirmedActionId: string | null;
  error: string | null;
  connect: (id: string, clubId?: string) => Promise<void>;
  disconnect: () => void;
  send: (command: GameCommand) => string | undefined;
  clearError: () => void;
};
let pending: ReturnType<typeof setTimeout> | undefined;
let actions: ActionQueue | undefined;
let connectionVersion = 0;
let recovery: { leagueId: string; clubId?: string } | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 1000;
let recoveryAttempts = 0;
let connecting = false;

function endRecovery() {
  const snapshot = useGameStore.getState().snapshot;
  useGameStore.getState().disconnect();
  useGameStore.setState({
    snapshot,
    error: 'Não foi possível reconectar após 3 tentativas. Abra sua carreira novamente.',
  });
}
function attemptRecovery() {
  if (!recovery || connecting) return;
  if (recoveryAttempts >= 3) {
    endRecovery();
    return;
  }
  recoveryAttempts++;
  void useGameStore.getState().connect(recovery.leagueId, recovery.clubId);
}
function scheduleRecovery() {
  if (
    !recovery ||
    !useGameStore.getState().snapshot ||
    retry ||
    connecting ||
    document.visibilityState === 'hidden'
  )
    return;
  if (recoveryAttempts >= 3) {
    endRecovery();
    return;
  }
  retry = setTimeout(() => {
    retry = undefined;
    attemptRecovery();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30000);
}
function resumeConnection() {
  if (document.visibilityState === 'hidden') {
    clearTimeout(retry);
    retry = undefined;
    return;
  }
  if (!recovery || connecting) return;
  if (!useGameStore.getState().connected) {
    clearTimeout(retry);
    retry = undefined;
    attemptRecovery();
  }
}
document.addEventListener('visibilitychange', resumeConnection);
window.addEventListener('online', resumeConnection);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    resumeConnection();
  }
});
export const useGameStore = create<GameStore>((set, get) => ({
  snapshot: null,
  clockOffset: 0,
  room: null,
  userId: '',
  connected: false,
  busy: false,
  loadingMessage: null,
  loadingActivity: null,
  pendingActions: 0,
  confirmedActionId: null,
  error: null,
  clearError: () => set({ error: null }),
  connect: async (leagueId, clubId) => {
    const resuming = recovery?.leagueId === leagueId;
    if (!resuming) recoveryAttempts = 0;
    recovery = { leagueId, ...(clubId ? { clubId } : {}) };
    const version = ++connectionVersion;
    connecting = true;
    clearTimeout(retry);
    retry = undefined;
    const previous = get().room;
    actions?.stop();
    actions = undefined;
    clearTimeout(pending);
    set({
      busy: true,
      error: null,
      snapshot: resuming ? get().snapshot : null,
      room: null,
      connected: false,
      pendingActions: 0,
    });
    try {
      await previous?.leave();
      const identity = await credentials();
      const { userId, ...authOptions } = identity;
      const cacheKey = `${userId}.${leagueId}`;
      let cached =
        import.meta.env.VITE_GAME_TRANSPORT === 'cloudflare'
          ? await loadSnapshotCache(cacheKey)
          : null;
      if (cached?.snapshot.state.id !== leagueId) cached = null;
      if (version !== connectionVersion) return;
      const options = {
        ...authOptions,
        leagueId,
        ...(import.meta.env.VITE_GAME_TRANSPORT === 'cloudflare'
          ? {
              localTables: true,
              deltaProtocol: true,
              compressedSnapshots: typeof DecompressionStream !== 'undefined',
              ...(cached ? { cache: cached.manifest } : {}),
            }
          : {}),
        ...(clubId ? { clubId } : {}),
      };
      const room: GameRoom =
        import.meta.env.VITE_GAME_TRANSPORT === 'cloudflare'
          ? await connectWorker(serverUrl, options)
          : await new Client(serverUrl).joinOrCreate('league', options);
      if (version !== connectionVersion) {
        void room.leave();
        return;
      }
      set({ room, userId, connected: true });
      let confirmed: GameSnapshot | null = null;
      // An open socket is not proof that the career was loaded. Retry the initial
      // snapshot once without relying on the local checkpoint, then release the UI.
      let initialSnapshotTimer: ReturnType<typeof setTimeout> | undefined;
      const loadingFailed = (message: string) => {
        clearTimeout(initialSnapshotTimer);
        if (get().room !== room || confirmed) return;
        set({ busy: false, connected: false, error: recoveryAttempts > 0 ? null : message });
        void room.leave();
      };
      initialSnapshotTimer = setTimeout(() => {
        if (get().room !== room || confirmed) return;
        cached = null;
        room.send('sync');
        initialSnapshotTimer = setTimeout(() => {
          loadingFailed(
            'Não foi possível carregar a carreira. Tente abri-la novamente. Seus dados salvos foram preservados.',
          );
        }, 15000);
      }, 10000);
      let activeId = '';
      const queueKey = `football.queue.${userId}.${leagueId}`;
      let restored: PendingAction[] = [];
      try {
        restored = z
          .array(pendingActionSchema)
          .max(50)
          .parse(JSON.parse(localStorage.getItem(queueKey) ?? '[]'))
          .map(({ revision, ...action }) => ({
            ...action,
            ...(revision === undefined ? {} : { revision }),
          }));
      } catch {
        set({ error: 'Não foi possível recuperar a fila local de ações' });
      }
      const queue = new ActionQueue(
        userId,
        (requestId, command) => {
          activeId = requestId;
          clearTimeout(pending);
          room.send('command', { requestId, command });
          pending = setTimeout(
            () => {
              if (get().room !== room) return;
              queue.stop(
                'A sincronização não foi confirmada. Reconecte para conferir as ações salvas.',
              );
              set({ connected: false });
              scheduleRecovery();
            },
            command.type === 'advance' || command.type === 'new-season' ? 120000 : 20000,
          );
        },
        (view) => {
          if (get().room === room)
            set({
              snapshot: view.snapshot,
              pendingActions: view.pendingActions,
              busy: view.busy || (view.advancing && get().loadingActivity === 'travel'),
              ...(!view.advancing ? { loadingActivity: null } : {}),
            });
        },
        (message) => {
          if (get().room === room) set({ error: message });
        },
        restored,
        (items) => {
          try {
            if (items.length) localStorage.setItem(queueKey, JSON.stringify(items));
            else localStorage.removeItem(queueKey);
          } catch {
            /* The active in-memory queue can still finish if storage is full. */
          }
        },
        import.meta.env.VITE_GAME_TRANSPORT === 'cloudflare' ? 150 : 0,
      );
      actions = queue;
      let resumeTimer: ReturnType<typeof setTimeout> | undefined;
      room.onMessage('resumed', () => {
        if (get().room !== room) return;
        clearTimeout(resumeTimer);
      });
      const accept = (snapshot: GameSnapshot) => {
        if (
          get().room !== room ||
          (confirmed && snapshot.state.revision < confirmed.state.revision)
        )
          return;
        if (import.meta.env.VITE_GAME_TRANSPORT === 'cloudflare')
          snapshot = { ...snapshot, tables: localTables(snapshot.state) };
        const recovered = queue.accept(snapshot);
        if (!get().pendingActions) clearTimeout(pending);
        clearTimeout(resumeTimer);
        confirmed = snapshot;
        clearTimeout(initialSnapshotTimer);
        clearTimeout(retry);
        retry = undefined;
        retryDelay = 1000;
        recoveryAttempts = 0;
        set({ connected: true });
        if (import.meta.env.VITE_GAME_TRANSPORT === 'cloudflare')
          saveSnapshotCache(cacheKey, snapshot);
        set({ clockOffset: (snapshot.serverTime ?? Date.now()) - Date.now() });
        if (recovered) set({ error: null, connected: true });
      };
      room.onMessage('snapshot-delta', (input: unknown) => {
        if (get().room !== room) return;
        const parsed = snapshotDeltaSchema.safeParse(input);
        const base = confirmed ?? cached?.snapshot;
        if (
          !parsed.success ||
          !base ||
          base.state.id !== parsed.data.leagueId ||
          base.state.revision !== parsed.data.baseRevision
        ) {
          cached = null;
          room.send('sync');
          return;
        }
        try {
          const update = parsed.data;
          const ledger = z.array(ledgerEntrySchema).parse(update.ledger);
          const state = applyStateChanges(base.state, update.changes);
          if (state.id !== leagueId || state.revision !== update.revision)
            throw new Error('Invalid revision');
          accept({
            state,
            ledger,
            tables: {},
            roomId: update.roomId,
            ...(update.serverTime !== undefined ? { serverTime: update.serverTime } : {}),
          });
          cached = null;
        } catch {
          cached = null;
          room.send('sync');
        }
      });
      let preparingResume = false;
      room.onMessage('cache-request', () => {
        if (get().room !== room) return;
        if (preparingResume) return;
        const base = confirmed;
        if (!base) {
          room.send('sync');
          return;
        }
        preparingResume = true;
        void prepareSnapshotManifest(base)
          .then((manifest) => {
            if (get().room !== room) return;
            if (confirmed !== base) return;
            if (manifest) room.send('cache-offer', manifest);
            else room.send('sync');
          })
          .finally(() => {
            preparingResume = false;
          });
      });
      room.onMessage('snapshot-update', (input: unknown) => {
        if (get().room !== room) return;
        const parsed = gameSnapshotUpdateSchema.safeParse(input);
        if (
          !parsed.success ||
          !confirmed ||
          confirmed.state.id !== parsed.data.leagueId ||
          confirmed.state.revision !== parsed.data.baseRevision
        ) {
          room.send('sync');
          return;
        }
        const update = parsed.data;
        accept({
          state: Object.assign({}, confirmed.state, update.patch, { revision: update.revision }),
          tables: update.tables,
          ledger: update.ledger,
          roomId: update.roomId,
          serverTime: update.serverTime,
        });
      });
      room.onMessage('snapshot', (input: unknown) => {
        if (get().room !== room) return;
        const parsed = gameSnapshotSchema.safeParse(input);
        if (!parsed.success) {
          queue.stop('O servidor enviou dados incompatíveis');
          loadingFailed('Não foi possível ler a carreira. Atualize a página e tente novamente.');
          return;
        }
        try {
          accept(parsed.data);
        } catch {
          loadingFailed('Não foi possível preparar a carreira. Tente abri-la novamente.');
        }
      });
      room.onMessage('error', (input: unknown) => {
        if (get().room !== room) return;
        const parsed = z
          .object({ message: z.string().max(1000), requestId: z.string().optional() })
          .safeParse(input);
        if (parsed.success && parsed.data.requestId) {
          if (parsed.data.requestId === activeId) clearTimeout(pending);
          queue.reject(parsed.data.requestId, parsed.data.message);
        } else {
          clearTimeout(pending);
          queue.stop(parsed.success ? parsed.data.message : 'Não foi possível concluir a operação');
          loadingFailed(
            parsed.success ? parsed.data.message : 'Não foi possível carregar a carreira.',
          );
        }
      });
      room.onMessage('ack', (input: unknown) => {
        if (get().room !== room) return;
        const parsed = z
          .object({ requestId: z.string(), revision: z.number().int().nonnegative() })
          .safeParse(input);
        if (!parsed.success) {
          queue.stop('Atualize o jogo para sincronizar com este servidor');
          return;
        }
        if (parsed.data.requestId === activeId) clearTimeout(pending);
        if (queue.acknowledge(parsed.data.requestId, parsed.data.revision))
          set({ error: null, connected: true });
        set({ confirmedActionId: parsed.data.requestId });
        if (queue.waitingForSnapshot)
          pending = setTimeout(() => {
            if (get().room !== room || !queue.waitingForSnapshot) return;
            room.send('sync');
            pending = setTimeout(() => {
              if (get().room !== room || !queue.waitingForSnapshot) return;
              queue.stop(
                'O avanço foi confirmado, mas a atualização da carreira não chegou. Reconectando para recuperar os dados salvos.',
              );
              set({ connected: false, busy: false });
              scheduleRecovery();
            }, 15000);
          }, 5000);
      });
      room.onError(() => {
        if (get().room === room) {
          clearTimeout(pending);
          queue.stop();
          set({ connected: false });
          loadingFailed('A conexão foi interrompida ao carregar a carreira. Tente novamente.');
          scheduleRecovery();
        }
      });
      const heartbeat =
        import.meta.env.VITE_GAME_TRANSPORT === 'cloudflare'
          ? undefined
          : setInterval(() => room.send('heartbeat'), 30000);
      const flushDrafts = () => {
        if (document.visibilityState === 'hidden') queue.flush();
        else if (get().room === room) {
          room.send(import.meta.env.VITE_GAME_TRANSPORT === 'cloudflare' ? 'resume' : 'sync');
          clearTimeout(resumeTimer);
          resumeTimer = setTimeout(() => {
            if (get().room !== room) return;
            set({ connected: false });
            scheduleRecovery();
          }, 10000);
          if (!get().connected) scheduleRecovery();
        }
      };
      document.addEventListener('visibilitychange', flushDrafts);
      room.onLeave(() => {
        clearTimeout(resumeTimer);
        clearTimeout(initialSnapshotTimer);
        clearInterval(heartbeat);
        document.removeEventListener('visibilitychange', flushDrafts);
        if (get().room === room) {
          clearTimeout(pending);
          queue.stop();
          actions = undefined;
          set({ connected: false, busy: false, room: null });
          if (!confirmed && !get().error)
            set({
              error: 'A conexão foi encerrada antes de carregar a carreira. Tente novamente.',
            });
          scheduleRecovery();
        }
      });
      if (import.meta.env.VITE_GAME_TRANSPORT !== 'cloudflare') room.send('sync');
      if (!resuming) location.hash = '/dashboard';
      localStorage.setItem('football.lastLeague', leagueId);
    } catch (error) {
      if (version !== connectionVersion) return;
      set({
        error:
          recoveryAttempts > 0
            ? null
            : error instanceof Error
              ? error.message
              : 'Não foi possível conectar ao servidor',
        busy: false,
      });
    } finally {
      if (version === connectionVersion) {
        connecting = false;
        if (!get().connected) scheduleRecovery();
      }
    }
  },
  disconnect: () => {
    recovery = undefined;
    connectionVersion++;
    connecting = false;
    retryDelay = 1000;
    recoveryAttempts = 0;
    clearTimeout(retry);
    retry = undefined;
    clearTimeout(pending);
    actions?.stop();
    actions = undefined;
    const room = get().room;
    set({
      room: null,
      snapshot: null,
      connected: false,
      error: null,
      busy: false,
      pendingActions: 0,
    });
    void room?.leave();
  },
  send: (command) => {
    if (!get().room || !get().connected || !actions) return;
    try {
      set({ error: null });
      const requestId = crypto.randomUUID();
      if (command.type === 'advance' && get().snapshot) {
        const state = get().snapshot!.state;
        const clubId = state.participants.find((member) => member.userId === get().userId)?.clubId;
        const fixtures = pendingFixtures(state);
        const batch = state.seasonClock
          ? (scheduledBatches(fixtures)[0] ?? [])
          : fixtures.filter((fixture) => fixture.scheduledAt === fixtures[0]?.scheduledAt);
        set({
          loadingActivity: batch.some(
            (fixture) => fixture.homeId === clubId || fixture.awayId === clubId,
          )
            ? 'travel'
            : clubId &&
                batch[0] &&
                gameDayStart(batch[0].scheduledAt) > gameDayStart(state.lastProcessedAt) &&
                clubCalendarRoutine(state, clubId, batch[0].scheduledAt) === 'training'
              ? 'training'
              : 'calendar',
        });
      }
      actions.enqueue(commandSchema.parse(command), requestId, Date.now() + get().clockOffset);
      return requestId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Não foi possível executar a ação' });
    }
  },
}));
