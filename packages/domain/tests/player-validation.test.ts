import type { WorldState } from '@football/shared';
import { expect, it } from 'vitest';
import { createWorld, playNextBatch, recordEvent } from '../src/index.js';
import { gameEventSchema } from '@football/shared';
import { unwrap } from '../../../tests/fixtures/domain.js';

it('equivale à validação completa, preserva jogadores intactos e rejeita alterações inválidas', () => {
  let state = unwrap(
    createWorld({
      id: crypto.randomUUID(),
      userId: 'host',
      name: 'Validação',
      mode: 'offline',
      now: 1,
    }),
  );
  const metadata = () => ({
    id: crypto.randomUUID(),
    actorId: 'host',
    occurredAt: 1,
    type: 'round.played' as const,
    message: 'Rodada',
    amount: 0,
  });
  for (let round = 0; round < 5; round++) {
    const next = unwrap(playNextBatch(state, round + 1));
    const event = unwrap(recordEvent(state, next, metadata()));
    expect(event).toEqual(gameEventSchema.parse(event));
    for (const id of state.players.ids)
      if (next.players.byId[id] === state.players.byId[id])
        expect(event.patch.players!.byId[id]).toBe(state.players.byId[id]);
    const id = next.players.ids[0]!;
    const bad = {
      ...next,
      players: {
        ...next.players,
        byId: { ...next.players.byId, [id]: { ...next.players.byId[id]!, fitness: -1 } },
      },
    };
    expect(recordEvent(state, bad, metadata()).ok).toBe(false);
    expect(
      recordEvent(
        state,
        {
          ...next,
          players: {
            ...next.players,
            byId: { ...next.players.byId, [crypto.randomUUID()]: next.players.byId[id]! },
          },
        },
        metadata(),
      ).ok,
    ).toBe(false);
    state = { ...state, ...event.patch, revision: event.sequence } as WorldState;
  }
}, 15000);
