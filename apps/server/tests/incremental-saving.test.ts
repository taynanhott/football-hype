import { describe, expect, it } from 'vitest';
import { appendFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createWorld, executeCommand, applyEvent } from '@football/domain';
import { randomUUID } from 'node:crypto';
import { gameSnapshotUpdateSchema } from '@football/shared';
import { LocalLeagueRepository } from '../src/repositories/local-league-repository.js';
import { unwrap } from '../../../tests/fixtures/domain.js';

describe('salvamento incremental', () => {
  it('atualizações pequenas não introduzem valores padrão que apaguem dados da liga', () => {
    const update = gameSnapshotUpdateSchema.parse({
      leagueId: randomUUID(),
      baseRevision: 0,
      revision: 1,
      patch: { revision: 1, negotiations: [] },
      tables: {},
      ledger: [],
      roomId: 'test',
    });
    expect(Object.keys(update.patch).sort()).toEqual(['negotiations', 'revision']);
  });
  it('preserva referências de dados inalterados e valida alterações do evento', () => {
    const state = unwrap(
      createWorld({ id: randomUUID(), userId: 'host', name: 'Teste', mode: 'offline', now: 1 }),
    );
    const event = unwrap(
      executeCommand(state, { type: 'ready', ready: true }, 'host', 1, randomUUID()),
    );
    const next = unwrap(applyEvent(state, event));
    expect(next.players).toBe(state.players);
    expect(next.results).toBe(state.results);
    expect(next.participants).not.toBe(state.participants);
    expect(applyEvent(state, { ...event, patch: { round: -1 } }).ok).toBe(false);
  });

  it('grava somente o evento e recupera a carreira após reinício e cauda interrompida', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'football-incremental-'));
    if (dirname(directory) !== tmpdir()) throw new Error('Diretório de teste inválido');
    try {
      const repository = new LocalLeagueRepository(directory);
      const state = unwrap(
        createWorld({ id: randomUUID(), userId: 'host', name: 'Teste', mode: 'offline', now: 1 }),
      );
      await repository.create(state);
      const file = join(directory, `${state.id}.json.gz`);
      const original = await readFile(file);
      const event = unwrap(
        executeCommand(state, { type: 'ready', ready: true }, 'host', 1, randomUUID()),
      );
      const next = unwrap(applyEvent(state, event));
      await repository.append(state.id, state.revision, next, event);
      expect(await readFile(file)).toEqual(original);
      expect((await stat(`${file}.events`)).size).toBeLessThan(JSON.stringify(state).length);
      await appendFile(`${file}.events`, '{"interrupted":');
      const restarted = new LocalLeagueRepository(directory);
      await restarted.initialize();
      const saved = await restarted.load(state.id);
      expect(saved?.state).toEqual(next);
      expect(saved?.events).toEqual([event]);
      expect((await readFile(`${file}.events`, 'utf8')).endsWith('\n')).toBe(true);
      let current = saved!.state;
      for (let index = 1; index < 129; index++) {
        const command = unwrap(
          executeCommand(
            current,
            { type: 'ready', ready: index % 2 === 0 },
            'host',
            1,
            randomUUID(),
          ),
        );
        const updated = unwrap(applyEvent(current, command));
        await restarted.append(current.id, current.revision, updated, command);
        current = updated;
      }
      expect(await readFile(file)).not.toEqual(original);
      const checkpointed = new LocalLeagueRepository(directory);
      await checkpointed.initialize();
      expect((await checkpointed.load(state.id))?.state).toEqual(current);
      expect((await checkpointed.load(state.id))?.events).toHaveLength(129);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
