import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createWorld } from '@football/domain';
import { unwrap } from '../../../tests/fixtures/domain';
import type { GameSnapshot } from '@football/shared';

const fake = vi.hoisted(() => ({
  handlers: new Map<string, (data: unknown) => void>(),
  send: vi.fn(),
  leave: vi.fn(async () => undefined),
  addEventListener: vi.fn(),
}));
vi.mock('../src/features/leagues/api', () => ({
  credentials: async () => ({ userId: 'host', guestId: 'host' }),
  serverUrl: 'wss://example.invalid',
}));
vi.mock('../src/store/worker-transport', () => ({
  connectWorker: vi.fn(async () => ({
    send: fake.send,
    leave: fake.leave,
    onMessage: (type: string, callback: (data: unknown) => void) =>
      fake.handlers.set(type, callback),
    onError: (callback: () => void) => fake.handlers.set('__error', callback),
    onLeave: (callback: () => void) => fake.handlers.set('__leave', callback),
  })),
}));
vi.mock('../src/store/snapshot-cache', () => ({
  loadSnapshotCache: async () => null,
  saveSnapshotCache: vi.fn(),
  prepareSnapshotManifest: async () => null,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('VITE_GAME_TRANSPORT', 'cloudflare');
  vi.stubGlobal('document', {
    addEventListener: fake.addEventListener,
    removeEventListener: vi.fn(),
    visibilityState: 'visible',
  });
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('location', { hash: '' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
  fake.handlers.clear();
  fake.send.mockClear();
  fake.leave.mockClear();
  fake.addEventListener.mockClear();
});
afterEach(async () => {
  const { useGameStore } = await import('../src/store/game-store');
  useGameStore.getState().disconnect();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('pede os dados completos quando a conexão abre sem carregar a carreira', async () => {
  const { useGameStore } = await import('../src/store/game-store');
  const state = unwrap(
    createWorld({
      id: crypto.randomUUID(),
      userId: 'host',
      name: 'Retomada',
      mode: 'offline',
      now: 1,
    }),
  );
  await useGameStore.getState().connect(state.id);
  expect(useGameStore.getState().busy).toBe(true);
  await vi.advanceTimersByTimeAsync(10000);
  expect(fake.send).toHaveBeenCalledExactlyOnceWith('sync');
  const snapshot: GameSnapshot = { state, tables: {}, roomId: 'test', ledger: [] };
  fake.handlers.get('snapshot')!(snapshot);
  expect(useGameStore.getState().snapshot?.state.id).toBe(state.id);
  expect(useGameStore.getState().busy).toBe(false);
  const listeners = fake.addEventListener.mock.calls;
  const resume = listeners.filter(([type]) => type === 'visibilitychange').at(-1)![1];
  fake.send.mockClear();
  (resume as () => void)();
  expect(fake.send).toHaveBeenCalledWith('resume');
  fake.handlers.get('resumed')!({});
  await vi.advanceTimersByTimeAsync(20000);
  expect(fake.leave).not.toHaveBeenCalled();
  expect(useGameStore.getState().connected).toBe(true);
  expect(fake.send).toHaveBeenCalledTimes(1);
});
it('encerra o loading se a confirmação chega mas a revisão salva não é recebida', async () => {
  const { useGameStore } = await import('../src/store/game-store');
  const state = unwrap(
    createWorld({
      id: crypto.randomUUID(),
      userId: 'host',
      name: 'Avanço',
      mode: 'offline',
      now: 1,
    }),
  );
  await useGameStore.getState().connect(state.id);
  fake.handlers.get('snapshot')!({ state, tables: {}, roomId: 'test', ledger: [], serverTime: 1 });
  const requestId = useGameStore.getState().send({ type: 'advance' });
  fake.handlers.get('ack')!({ requestId, revision: state.revision + 1 });
  await vi.advanceTimersByTimeAsync(5000);
  expect(fake.send).toHaveBeenCalledWith('sync');
  await vi.advanceTimersByTimeAsync(15000);
  expect(useGameStore.getState().busy).toBe(false);
  expect(useGameStore.getState().connected).toBe(false);
  expect(useGameStore.getState().snapshot?.state).toEqual(state);
  expect(useGameStore.getState().error).toContain('avanço foi confirmado');
});
it('libera a tela com erro e preserva a carreira se o servidor não entregar dados', async () => {
  const { useGameStore } = await import('../src/store/game-store');
  await useGameStore.getState().connect(crypto.randomUUID());
  await vi.advanceTimersByTimeAsync(25000);
  expect(useGameStore.getState().busy).toBe(false);
  expect(useGameStore.getState().error).toContain('dados salvos foram preservados');
  expect(fake.send).toHaveBeenCalledTimes(1);
  expect(fake.leave).toHaveBeenCalledTimes(1);
});
it('encerra o carregamento quando os dados recebidos são incompatíveis', async () => {
  const { useGameStore } = await import('../src/store/game-store');
  await useGameStore.getState().connect(crypto.randomUUID());
  fake.handlers.get('snapshot')!({ state: {} });
  expect(useGameStore.getState().busy).toBe(false);
  expect(useGameStore.getState().error).toContain('ler a carreira');
});

it('faz apenas três tentativas de reconexão e preserva a tela da carreira após falharem', async () => {
  const { useGameStore } = await import('../src/store/game-store');
  const { connectWorker } = await import('../src/store/worker-transport');
  const state = unwrap(
    createWorld({
      id: crypto.randomUUID(),
      userId: 'host',
      name: 'Reconexão',
      mode: 'offline',
      now: 1,
    }),
  );
  await useGameStore.getState().connect(state.id);
  fake.handlers.get('snapshot')!({ state, tables: {}, roomId: 'test', ledger: [] });
  expect(useGameStore.getState().snapshot).not.toBeNull();
  const transport = vi.mocked(connectWorker);
  transport.mockClear();
  transport
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce(new Error('offline'));
  fake.handlers.get('__error')!(undefined);
  await vi.advanceTimersByTimeAsync(10000);
  expect(transport).toHaveBeenCalledTimes(3);
  expect(useGameStore.getState().snapshot?.state).toEqual(state);
  expect(useGameStore.getState().room).toBeNull();
  expect(useGameStore.getState().busy).toBe(false);
  expect(useGameStore.getState().error).toContain('3 tentativas');
  await vi.advanceTimersByTimeAsync(60000);
  expect(transport).toHaveBeenCalledTimes(3);
});

it('para as tentativas quando a carreira é recuperada', async () => {
  const { useGameStore } = await import('../src/store/game-store');
  const { connectWorker } = await import('../src/store/worker-transport');
  const state = unwrap(
    createWorld({
      id: crypto.randomUUID(),
      userId: 'host',
      name: 'Reconectada',
      mode: 'offline',
      now: 1,
    }),
  );
  const snapshot = { state, tables: {}, roomId: 'test', ledger: [] };
  await useGameStore.getState().connect(state.id);
  fake.handlers.get('snapshot')!(snapshot);
  vi.mocked(connectWorker).mockClear();
  fake.handlers.get('__leave')!(undefined);
  await vi.advanceTimersByTimeAsync(1000);
  fake.handlers.get('snapshot')!(snapshot);
  await vi.advanceTimersByTimeAsync(60000);
  expect(connectWorker).toHaveBeenCalledTimes(1);
  expect(useGameStore.getState().connected).toBe(true);
  expect(useGameStore.getState().snapshot?.state.id).toBe(state.id);
});
