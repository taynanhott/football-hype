import { afterEach, describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorld, success, type DataProvider } from '@football/domain';
import { worldDatasetSchema } from '@football/shared';
import {
  ApiFootballDataProvider,
  mergeApiFootball,
} from '../src/providers/api-football-provider.js';
import { LeagueService } from '../src/application/league-service.js';
import { LocalLeagueRepository } from '../src/repositories/local-league-repository.js';
const now = Date.parse('2026-10-27T15:00:00Z');
const generated = createWorld({
  id: '00000090-0000-4000-8000-000000000001',
  userId: 'api-user',
  name: 'Teste',
  mode: 'offline',
  now,
});
if (!generated.ok) throw Error('World');
const world = generated.value;
const base = worldDatasetSchema.parse({
  clubs: world.clubs,
  players: world.players,
  stadiums: world.stadiums,
  centers: world.centers,
  fixtures: world.fixtures,
  source: 'Base default de teste',
  license: 'Fixture fictícia',
});
const first = base.players.byId[base.players.ids[0]!]!,
  club = base.clubs.byId[first.clubId!]!;
const payload = {
  errors: [],
  paging: { current: 1, total: 40 },
  response: [
    {
      player: { name: first.name, age: 25, nationality: 'Brazil' },
      statistics: [{ team: { name: club.name }, games: { position: 'Goalkeeper' } }],
    },
  ],
};
const dirs: string[] = [];
afterEach(async () => {
  for (const p of dirs.splice(0)) await rm(p, { recursive: true, force: true });
});
async function setup(
  request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(payload))),
  dailyLimit = 100,
) {
  const directory = await mkdtemp(join(tmpdir(), 'football-api-'));
  dirs.push(directory);
  const fallback: DataProvider = { load: async () => success(base) };
  return {
    directory,
    request,
    fallback,
    provider: new ApiFootballDataProvider(
      fallback,
      { key: 'test-key', directory, dailyLimit },
      request,
      () => now,
    ),
  };
}
describe('API quota and saved default', () => {
  it('never fetches for catalogs and uses at most one call per creation across restarts', async () => {
    const { provider, request, fallback, directory } = await setup();
    await provider.load();
    expect(request).not.toHaveBeenCalled();
    await provider.bootstrap();
    await provider.bootstrap();
    expect(request).toHaveBeenCalledTimes(1);
    await Promise.all([provider.loadForLeague('same'), provider.loadForLeague('same')]);
    expect(request).toHaveBeenCalledTimes(2);
    const restarted = new ApiFootballDataProvider(
      fallback,
      { key: 'test-key', directory },
      request,
      () => now,
    );
    await restarted.loadForLeague('same');
    await restarted.load();
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readFile(join(directory, 'quota.json'), 'utf8')).used).toBe(2);
  });
  it('preserves all clubs and players when a response is only one page', () => {
    const result = mergeApiFootball(base, payload);
    expect(result.clubs.ids).toEqual(base.clubs.ids);
    expect(result.players.ids).toEqual(base.players.ids);
    expect(result.players.byId[first.id]?.age).toBe(25);
    expect(result.players.byId[first.id]?.position).toBe(first.position);
  });
  it('uses the persisted default when the local quota is exhausted', async () => {
    const { provider, request } = await setup(undefined, 1);
    await provider.bootstrap();
    const result = await provider.loadForLeague('new');
    expect(result.ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    if (result.ok) expect(result.value.players.byId[first.id]?.age).toBe(25);
  });
  it('handles HTTP 429 and provider quota errors without retrying', async () => {
    for (const response of [
      new Response('', { status: 429 }),
      new Response(JSON.stringify({ errors: { requests: 'Daily limit reached' }, response: [] })),
    ]) {
      const request = vi.fn<typeof fetch>(async () => response);
      const { provider } = await setup(request);
      expect((await provider.loadForLeague('one')).ok).toBe(true);
      expect((await provider.loadForLeague('two')).ok).toBe(true);
      expect(request).toHaveBeenCalledTimes(1);
    }
  });
  it('uses local data after network failure, invalid JSON and season restrictions', async () => {
    for (const mode of ['network', 'json', 'season']) {
      const request = vi.fn<typeof fetch>(async () => {
        if (mode === 'network') throw Error('Offline');
        return new Response(
          mode === 'json'
            ? 'bad'
            : JSON.stringify({ errors: { plan: '2026 unavailable' }, response: [] }),
        );
      });
      const { provider } = await setup(request);
      const result = await provider.loadForLeague('one');
      expect(result.ok).toBe(true);
      await provider.loadForLeague('one');
      expect(request).toHaveBeenCalledTimes(1);
      if (result.ok) expect(result.value.clubs.ids).toEqual(base.clubs.ids);
    }
  });
  it('makes no new calls on career reads or repeated creation', async () => {
    const { provider, request } = await setup();
    const service = new LeagueService(new LocalLeagueRepository(undefined), () => now, provider);
    const identity = { userId: 'api-test', name: 'Teste', guest: true };
    await service.catalog();
    expect(request).not.toHaveBeenCalled();
    const id = await service.create(identity, { name: 'Teste', mode: 'offline' });
    await service.snapshot(id, identity.userId);
    await service.list(identity.userId);
    expect(await service.create(identity, { name: 'Teste', mode: 'offline' })).toBe(id);
    await service.command(id, identity.userId, { type: 'advance' });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('never exceeds 100 locally even if a higher cap is supplied', async () => {
    const { provider, request, directory } = await setup(undefined, 999);
    await writeFile(
      join(directory, 'quota.json'),
      JSON.stringify({
        day: new Date(now).toISOString().slice(0, 10),
        used: 100,
        blocked: false,
        attempted: {},
      }),
    );
    expect((await provider.loadForLeague('over-limit')).ok).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
  it('honors the remaining quota header and resets only new attempts on a new day', async () => {
    const request = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(payload), {
          headers: { 'x-ratelimit-requests-remaining': '0' },
        }),
    );
    const { directory, fallback } = await setup(request);
    let clock = now;
    const provider = new ApiFootballDataProvider(
      fallback,
      { key: 'test-key', directory },
      request,
      () => clock,
    );
    await provider.loadForLeague('one');
    await provider.loadForLeague('two');
    expect(request).toHaveBeenCalledTimes(1);
    clock += 86400000;
    await provider.loadForLeague('one');
    expect(request).toHaveBeenCalledTimes(1);
    await provider.loadForLeague('three');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
