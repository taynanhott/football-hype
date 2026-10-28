import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createWorld } from '@football/domain';
import { LocalLeagueRepository } from '../src/repositories/local-league-repository.js';

describe('regularização local de uma temporada', () => {
  it('recarrega uma carreira corrigida em disco sem manter a revisão antiga em memória', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'football-season-reload-'));
    try {
      const world = createWorld({
        id: '00000090-0000-4000-8000-000000000099',
        userId: 'reload-user',
        name: 'Antes',
        mode: 'offline',
        now: Date.parse('2026-10-27T15:00:00Z'),
      });
      if (!world.ok) throw new Error(world.error.message);
      const repository = new LocalLeagueRepository(directory);
      await repository.initialize();
      await repository.create(world.value);
      expect((await repository.load(world.value.id))?.state.name).toBe('Antes');
      const updated = { ...world.value, name: 'Temporada regularizada', revision: 1 };
      await writeFile(
        join(directory, `${world.value.id}.json.gz`),
        gzipSync(JSON.stringify({ state: updated, events: [] })),
      );
      expect((await repository.load(world.value.id))?.state.name).toBe('Temporada regularizada');
      expect((await repository.load(world.value.id))?.state.revision).toBe(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
