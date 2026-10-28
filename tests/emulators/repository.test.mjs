import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { FirestoreLeagueRepository } from '../../apps/server/dist/repositories/firestore-league-repository.js';
import { createWorld, executeCommand, applyEvent } from '../../packages/domain/dist/index.js';

function unwrap(result) {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}
test('repositório Firestore persiste snapshots, eventos e vínculos transacionais', async () => {
  const userId = `repository-${randomUUID()}`;
  const state = unwrap(
    createWorld({
      id: randomUUID(),
      userId,
      name: 'Integração Firebase',
      mode: 'offline',
      now: Date.parse('2026-10-26T15:00:00Z'),
    }),
  );
  const repository = new FirestoreLeagueRepository();
  await repository.create(state);
  assert.equal((await repository.load(state.id)).state.revision, 0);
  const event = unwrap(
    executeCommand(
      state,
      { type: 'upgrade', target: 'structure' },
      userId,
      state.createdAt,
      randomUUID(),
    ),
  );
  const next = unwrap(applyEvent(state, event));
  await repository.append(state.id, 0, next, event);
  const loaded = await new FirestoreLeagueRepository().load(state.id);
  assert.deepEqual(loaded.state, next);
  assert.deepEqual(loaded.events, [event]);
  assert.equal((await repository.forUser(userId))[0].id, state.id);
  assert.equal((await repository.due(next.nextScheduledAt)).includes(state.id), false);
  const online = unwrap(
    createWorld({
      id: randomUUID(),
      userId,
      name: 'Online',
      mode: 'multiplayer',
      now: state.createdAt,
    }),
  );
  await repository.create(online);
  assert.ok((await repository.due(online.nextScheduledAt)).includes(online.id));
  await assert.rejects(repository.append(state.id, 0, next, event), /mudou/);
  await assert.rejects(repository.create({ ...state, id: randomUUID() }), /já participa/);
});
