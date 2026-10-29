import { create } from 'zustand';
import { z } from 'zod';
import { Client } from 'colyseus.js';
import { connectWorker, type GameRoom } from './worker-transport';
import {
  commandSchema,
  gameSnapshotSchema,
  gameSnapshotUpdateSchema,
  type GameCommand,
  type GameSnapshot,
} from '@football/shared';
import { credentials, serverUrl } from '../features/leagues/api';
import { ActionQueue, type PendingAction } from './action-queue';

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
  pendingActions: number;
  error: string | null;
  connect: (id: string, clubId?: string) => Promise<void>;
  disconnect: () => void;
  send: (command: GameCommand) => void;
  clearError: () => void;
};
let pending: ReturnType<typeof setTimeout> | undefined;
let actions: ActionQueue | undefined;
export const useGameStore = create<GameStore>((set, get) => ({
  snapshot: null,
  clockOffset: 0,
  room: null,
  userId: '',
  connected: false,
  busy: false,
  pendingActions: 0,
  error: null,
  clearError: () => set({ error: null }),
  connect: async (leagueId, clubId) => {
    const previous = get().room;
    actions?.stop();
    actions = undefined;
    clearTimeout(pending);
    set({
      busy: true,
      error: null,
      snapshot: null,
      room: null,
      connected: false,
      pendingActions: 0,
    });
    try {
      await previous?.leave();
      const identity = await credentials();
      const { userId, ...authOptions } = identity;
      const options = {
        ...authOptions,
        leagueId,
        ...(clubId ? { clubId } : {}),
      };
      const room: GameRoom =
        import.meta.env.VITE_GAME_TRANSPORT === 'cloudflare'
          ? await connectWorker(serverUrl, options)
          : await new Client(serverUrl).joinOrCreate('league', options);
      set({ room, userId, connected: true });
      let confirmed: GameSnapshot | null = null;
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
            },
            command.type === 'advance' || command.type === 'new-season' ? 120000 : 20000,
          );
        },
        (view) => {
          if (get().room === room) set(view);
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
      );
      actions = queue;
      const accept = (snapshot: GameSnapshot) => {
        if (
          get().room !== room ||
          (confirmed && snapshot.state.revision < confirmed.state.revision)
        )
          return;
        confirmed = snapshot;
        set({ clockOffset: (snapshot.serverTime ?? Date.now()) - Date.now() });
        if (queue.accept(snapshot)) set({ error: null, connected: true });
      };
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
          return;
        }
        accept(parsed.data);
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
        if (queue.waitingForSnapshot)
          pending = setTimeout(() => {
            if (get().room === room && queue.waitingForSnapshot) room.send('sync');
          }, 5000);
      });
      room.onError(() => {
        if (get().room === room) {
          clearTimeout(pending);
          queue.stop('A conexão foi interrompida. Reconecte à liga.');
        }
      });
      const heartbeat = setInterval(() => room.send('heartbeat'), 30000);
      room.onLeave(() => {
        clearInterval(heartbeat);
        if (get().room === room) {
          clearTimeout(pending);
          queue.stop();
          actions = undefined;
          set({ connected: false, busy: false, snapshot: null, room: null, pendingActions: 0 });
        }
      });
      room.send('sync');
      location.hash = '/dashboard';
      localStorage.setItem('football.lastLeague', leagueId);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Não foi possível conectar ao servidor',
        busy: false,
      });
    }
  },
  disconnect: () => {
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
      actions.enqueue(
        commandSchema.parse(command),
        crypto.randomUUID(),
        Date.now() + get().clockOffset,
      );
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Não foi possível executar a ação' });
    }
  },
}));
