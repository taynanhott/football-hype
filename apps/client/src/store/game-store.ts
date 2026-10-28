import { create } from 'zustand';
import { z } from 'zod';
import { Client, type Room } from 'colyseus.js';
import {
  commandSchema,
  gameSnapshotSchema,
  gameSnapshotUpdateSchema,
  type GameCommand,
  type GameSnapshot,
} from '@football/shared';
import { credentials, serverUrl } from '../features/leagues/api';

type GameStore = {
  snapshot: GameSnapshot | null;
  clockOffset: number;
  room: Room | null;
  userId: string;
  connected: boolean;
  busy: boolean;
  error: string | null;
  connect: (id: string, clubId?: string) => Promise<void>;
  disconnect: () => void;
  send: (command: GameCommand) => void;
  clearError: () => void;
};
let pending: ReturnType<typeof setTimeout> | undefined;
export const useGameStore = create<GameStore>((set, get) => ({
  snapshot: null,
  clockOffset: 0,
  room: null,
  userId: '',
  connected: false,
  busy: false,
  error: null,
  clearError: () => set({ error: null }),
  connect: async (leagueId, clubId) => {
    set({ busy: true, error: null });
    try {
      await get().room?.leave();
      const identity = await credentials();
      const { userId, ...authOptions } = identity;
      const room = await new Client(serverUrl).joinOrCreate('league', {
        ...authOptions,
        leagueId,
        ...(clubId ? { clubId } : {}),
      });
      set({ room, userId, connected: true });
      room.onMessage('snapshot-update', (input: unknown) => {
        if (get().room !== room) return;
        const parsed = gameSnapshotUpdateSchema.safeParse(input);
        const current = get().snapshot;
        if (
          !parsed.success ||
          !current ||
          current.state.id !== parsed.data.leagueId ||
          current.state.revision !== parsed.data.baseRevision
        ) {
          room.send('sync');
          return;
        }
        const update = parsed.data;
        if (update.revision < current.state.revision) return;
        clearTimeout(pending);
        set({
          snapshot: {
            state: Object.assign({}, current.state, update.patch, { revision: update.revision }),
            tables: update.tables,
            ledger: update.ledger,
            roomId: update.roomId,
            serverTime: update.serverTime,
          },
          busy: false,
          clockOffset: (update.serverTime ?? Date.now()) - Date.now(),
        });
      });
      room.onMessage('snapshot', (input: unknown) => {
        const parsed = gameSnapshotSchema.safeParse(input);
        if (!parsed.success) {
          set({ busy: false, error: 'O servidor enviou dados incompatíveis' });
          return;
        }
        if (get().room !== room) return;
        const current = get().snapshot?.state;
        if (current?.id === parsed.data.state.id && parsed.data.state.revision < current.revision)
          return;
        clearTimeout(pending);
        set({
          snapshot: parsed.data,
          busy: false,
          clockOffset: (parsed.data.serverTime ?? Date.now()) - Date.now(),
        });
      });
      room.onMessage('error', (input: unknown) => {
        const parsed = z.object({ message: z.string().max(1000) }).safeParse(input);
        clearTimeout(pending);
        set({
          error: parsed.success ? parsed.data.message : 'Não foi possível concluir a operação',
          busy: false,
        });
      });
      room.onMessage('ack', () => {
        clearTimeout(pending);
        set({ busy: false });
      });
      room.onError(() => set({ error: 'A conexão foi interrompida', busy: false }));
      const heartbeat = setInterval(() => room.send('heartbeat'), 30000);
      room.onLeave(() => {
        clearInterval(heartbeat);
        if (get().room === room) set({ connected: false, busy: false, snapshot: null, room: null });
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
    const room = get().room;
    set({ room: null, snapshot: null, connected: false, error: null, busy: false });
    void room?.leave();
  },
  send: (command) => {
    const { room, connected, busy } = get();
    if (!room || !connected || busy) return;
    set({ busy: true, error: null });
    room.send('command', commandSchema.parse(command));
    clearTimeout(pending);
    pending = setTimeout(
      () =>
        set({
          busy: false,
          error: 'O servidor demorou a responder. Reconecte para conferir a operação',
        }),
      20000,
    );
  },
}));
