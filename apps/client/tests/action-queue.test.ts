import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createWorld, executeCommand, applyEvent } from '@football/domain';
import type { GameCommand, GameEvent, GameSnapshot, WorldState } from '@football/shared';
import { unwrap } from '../../../tests/fixtures/domain.js';
import { ActionQueue, type QueueView } from '../src/store/action-queue';

let initial: WorldState;
beforeAll(() => {
  initial = unwrap(
    createWorld({ id: randomUUID(), userId: 'host', name: 'Fila', mode: 'offline', now: 1 }),
  );
});
function snapshot(state: WorldState, event?: GameEvent): GameSnapshot {
  return { state, tables: {}, roomId: 'test', serverTime: 1, ledger: event ? [event] : [] };
}
function setup() {
  const send = vi.fn();
  const error = vi.fn();
  let view: QueueView;
  const queue = new ActionQueue(
    'host',
    send,
    (next) => {
      view = next;
    },
    error,
  );
  queue.accept(snapshot(initial));
  return { queue, send, error, view: () => view! };
}
const price = (priceCents: number): GameCommand => ({ type: 'home-ticket-price', priceCents });
function applied(state: WorldState, command: GameCommand, id: string) {
  const event = unwrap(executeCommand(state, command, 'host', 1, id));
  return { event, state: unwrap(applyEvent(state, event)) };
}

describe('fila de ações com resposta local', () => {
  it.each(['ack-first', 'snapshot-first'])(
    'mostra as alterações imediatamente e envia em ordem (%s)',
    (order) => {
      const { queue, send, view } = setup();
      const first = randomUUID();
      const second = randomUUID();
      queue.enqueue(price(5000), first, 1);
      queue.enqueue(price(7500), second, 1);
      const clubId = initial.participants[0]!.clubId;
      expect(view().snapshot.state.homeTicketPrices?.[clubId]).toBe(7500);
      expect(view().busy).toBe(false);
      expect(view().pendingActions).toBe(2);
      expect(send.mock.calls.map((call) => call[0])).toEqual([first]);
      const confirmed = applied(initial, price(5000), first);
      if (order === 'ack-first') queue.acknowledge(first, confirmed.state.revision);
      else queue.accept(snapshot(confirmed.state, confirmed.event));
      expect(send).toHaveBeenCalledTimes(1);
      if (order === 'ack-first') queue.accept(snapshot(confirmed.state, confirmed.event));
      else queue.acknowledge(first, confirmed.state.revision);
      expect(send.mock.calls.map((call) => call[0])).toEqual([first, second]);
      expect(view().snapshot.state.homeTicketPrices?.[clubId]).toBe(7500);
      const last = applied(confirmed.state, price(7500), second);
      queue.accept(snapshot(last.state, last.event));
      queue.acknowledge(second, last.state.revision);
      expect(view().pendingActions).toBe(0);
      expect(view().snapshot.state).toBe(last.state);
    },
  );
  it('reverte uma ação recusada e mantém a próxima ação válida', () => {
    const { queue, send, view, error } = setup();
    const first = randomUUID();
    const second = randomUUID();
    queue.enqueue(price(5000), first, 1);
    queue.enqueue(price(7500), second, 1);
    queue.reject(first, 'Operação recusada');
    expect(error).toHaveBeenCalledWith('Operação recusada');
    expect(send.mock.calls.map((call) => call[0])).toEqual([first, second]);
    expect(view().snapshot.state.revision).toBe(initial.revision + 1);
    expect(view().pendingActions).toBe(1);
  });
  it('rebaseia ações pendentes sobre mudanças recebidas de outro treinador', () => {
    const { queue, view } = setup();
    queue.enqueue(price(5000), randomUUID(), 1);
    const updated = { ...initial, revision: initial.revision + 1, name: 'Nome atualizado' };
    queue.accept(snapshot(updated));
    expect(view().snapshot.state.name).toBe('Nome atualizado');
    expect(view().snapshot.state.homeTicketPrices?.[initial.participants[0]!.clubId]).toBe(5000);
  });
  it('valida localmente, não reenvia ações após timeout e não mantém sucesso provisório', () => {
    const { queue, send, view } = setup();
    expect(() => queue.enqueue(price(-1), randomUUID(), 1)).toThrow();
    expect(send).not.toHaveBeenCalled();
    queue.enqueue(price(5000), randomUUID(), 1);
    queue.stop('Sem confirmação');
    expect(view().snapshot.state).toBe(initial);
    expect(view().pendingActions).toBe(1);
    expect(() => queue.enqueue(price(7500), randomUUID(), 1)).toThrow('Reconecte');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('aguarda a simulação de rodada sem executá-la duas vezes no cliente', () => {
    const { queue, view } = setup();
    queue.enqueue({ type: 'advance' }, randomUUID(), 1);
    expect(view().busy).toBe(true);
    expect(view().snapshot.state.round).toBe(initial.round);
    expect(() => queue.enqueue(price(5000), randomUUID(), 1)).toThrow('rodada');
  });
  it('recupera a fila após recarregar sem aplicar duas vezes uma ação já confirmada', () => {
    let saved: import('../src/store/action-queue').PendingAction[] = [];
    const first = randomUUID();
    const queue = new ActionQueue('host', vi.fn(), vi.fn(), vi.fn(), [], (actions) => {
      saved = structuredClone([...actions]);
    });
    queue.accept(snapshot(initial));
    queue.enqueue(price(5000), first, 1);
    expect(saved[0]?.sent).toBe(true);
    queue.stop('Sem conexão');
    expect(saved).toHaveLength(1);
    const confirmed = applied(initial, price(5000), first);
    const send = vi.fn();
    let latest: QueueView;
    const resumed = new ActionQueue(
      'host',
      send,
      (view) => {
        latest = view;
      },
      vi.fn(),
      saved,
    );
    resumed.accept(snapshot(confirmed.state, confirmed.event));
    expect(latest!.snapshot.state.revision).toBe(confirmed.state.revision);
    expect(send).toHaveBeenCalledWith(first, price(5000));
    resumed.acknowledge(first, confirmed.state.revision);
    expect(latest!.pendingActions).toBe(0);
  });
});
