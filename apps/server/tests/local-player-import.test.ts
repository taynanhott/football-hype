import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { stableId } from '@football/domain';
import { worldDatasetSchema } from '@football/shared';
import { convertLocalPlayers } from '../src/providers/local-player-import.js';
import { FileDataProvider } from '../src/repositories/file-data-provider.js';
import { LeagueService } from '../src/application/league-service.js';
import { LocalLeagueRepository } from '../src/repositories/local-league-repository.js';
const file = fileURLToPath(new URL('../../../data/player-database.json', import.meta.url));
const source = JSON.parse(
  await readFile(
    fileURLToPath(new URL('../../../data/player-source.json', import.meta.url)),
    'utf8',
  ),
);
const metadata = JSON.parse(
  await readFile(
    fileURLToPath(new URL('../../../data/clubs-source.json', import.meta.url)),
    'utf8',
  ),
);
afterEach(() => vi.unstubAllGlobals());
describe('base local fornecida', () => {
  it('preserva jogadores, transferências, avaliações e jovens sem gerar atletas substitutos', () => {
    const { dataset, report } = convertLocalPlayers(source, metadata, [340950]);
    expect(report.skipped).toEqual([]);
    expect(report.unknownNationalities).toEqual([]);
    expect(dataset.players.ids.length).toBeGreaterThan(12000);
    expect(new Set(dataset.players.ids).size).toBe(dataset.players.ids.length);
    const players = Object.values(dataset.players.byId);
    const names = new Set(
      Object.values(source)
        .filter(Array.isArray)
        .flat()
        .filter((r) => r.length >= 12 && typeof r[1] === 'string')
        .map((r) => r[1]),
    );
    expect(players.every((p) => names.has(p.name))).toBe(true);
    const neymar = players.find((p) => p.name === 'Neymar')!;
    expect(dataset.clubs.byId[neymar.clubId!]?.name).toBe('Santos');
    expect(neymar.overall).toBe(81);
    const academyOnly = source.base26.find(
      (row: unknown[]) => !source.bra.some((senior: unknown[]) => senior[0] === row[0]),
    );
    expect(dataset.players.byId[stableId(32, academyOnly[0])]?.clubId).toBeNull();
    for (const patch of source.mv26) {
      const player = dataset.players.byId[stableId(32, patch[0])];
      if (player)
        expect(player.clubId ? dataset.clubs.byId[player.clubId]?.name : 'Sem clube').toBe(
          patch[1],
        );
    }
  });
  it('cria a liga com a base local e disputa Série A, B e copas sem usar APIs', async () => {
    const request = vi.fn(() => {
      throw Error('Network forbidden');
    });
    vi.stubGlobal('fetch', request);
    let now = Date.parse('2026-10-27T15:00:00Z');
    const service = new LeagueService(
      new LocalLeagueRepository(undefined),
      () => now,
      new FileDataProvider(file),
    );
    const catalog = await service.catalog();
    expect(catalog.clubs.filter((c) => c.division === 'A')).toHaveLength(20);
    expect(catalog.clubs.filter((c) => c.division === 'B')).toHaveLength(20);
    const flamengo = catalog.clubs.find((c) => c.name === 'Flamengo')!;
    const identity = { userId: 'json-import-user', name: 'Teste', guest: true };
    const id = await service.create(identity, {
      name: 'JSON',
      mode: 'offline',
      clubId: flamengo.id,
      assignment: 'chosen',
    });
    let snapshot = await service.snapshot(id, identity.userId);
    expect(snapshot.state.players.ids.length).toBeGreaterThan(12000);
    expect(snapshot.state.fixtures.some((fixture) => fixture.group)).toBe(true);
    expect(snapshot.state.fixtures.some((f) => f.competitionId === 'serie-b')).toBe(true);
    for (let i = 0; i < 5; i++) {
      now += 100000;
      await service.command(id, identity.userId, { type: 'advance' });
      snapshot = await service.snapshot(id, identity.userId);
      if (
        snapshot.state.results.some((r) => r.fixtureId.startsWith('serie-a:')) &&
        snapshot.state.results.some((r) => r.fixtureId.startsWith('serie-b:'))
      )
        break;
    }
    expect(snapshot.state.results.some((r) => r.fixtureId.startsWith('serie-a:'))).toBe(true);
    expect(snapshot.state.results.some((r) => r.fixtureId.startsWith('serie-b:'))).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(worldDatasetSchema.safeParse(JSON.parse(await readFile(file, 'utf8'))).success).toBe(
      true,
    );
  }, 20000);
});
