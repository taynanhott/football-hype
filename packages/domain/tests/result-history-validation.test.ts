import { expect, it } from 'vitest';
import { createWorld, playNextBatch, recordEvent } from '../src/index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';

it('preserva resultados já validados e rejeita alterações inválidas no histórico e nos jogos novos', () => {
  const initial = unwrap(
    createWorld({
      id: crypto.randomUUID(),
      userId: 'host',
      name: 'Histórico',
      mode: 'offline',
      now: 1,
    }),
  );
  const previous = unwrap(playNextBatch(initial, 1));
  const next = unwrap(playNextBatch(previous, 100000));
  const metadata = {
    id: crypto.randomUUID(),
    actorId: 'host',
    occurredAt: 100000,
    type: 'round.played' as const,
    message: 'Rodada',
    amount: 0,
  };
  const event = unwrap(recordEvent(previous, next, metadata));
  expect(event.patch.results).toEqual(next.results);
  expect(event.patch.results![0]).toBe(previous.results[0]);
  const invalid = { ...next, results: [...next.results] };
  invalid.results[previous.results.length] = {
    ...next.results[previous.results.length]!,
    homeGoals: -1,
  };
  expect(recordEvent(previous, invalid, metadata).ok).toBe(false);
  invalid.results = [...next.results];
  invalid.results[0] = { ...next.results[0]!, homeGoals: -1 };
  expect(recordEvent(previous, invalid, metadata).ok).toBe(false);
});
