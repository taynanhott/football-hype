import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { success, type DataProvider, type Result } from '@football/domain';
import { worldDatasetSchema, type WorldDataset } from '@football/shared';

const ledgerSchema = z.object({
  day: z.string(),
  used: z.number().int().nonnegative(),
  blocked: z.boolean(),
  blockedReason: z.enum(['quota', 'plan']).optional(),
  attempted: z.record(z.string(), z.boolean()),
});
const responseSchema = z.object({
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  response: z.array(
    z.object({
      player: z.object({
        name: z.string(),
        firstname: z.string().nullish(),
        lastname: z.string().nullish(),
        age: z.number().int().nullish(),
        nationality: z.string().nullish(),
      }),
      statistics: z.array(
        z.object({
          team: z.object({ name: z.string() }),
          games: z.object({ position: z.string().nullish() }),
        }),
      ),
    }),
  ),
  paging: z.object({ current: z.number(), total: z.number() }).optional(),
});
const canonical = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
/** Updates only verified name + club matches. A single page never replaces a whole squad. */
export function mergeApiFootball(base: WorldDataset, input: unknown): WorldDataset {
  const data = responseSchema.parse(input);
  if (Object.keys(data.errors).length) throw new Error('API-Football indisponível');
  if (!data.response.length) throw new Error('Resposta sem jogadores');
  const players = { ...base.players.byId };
  let updated = 0;
  for (const row of data.response) {
    const profile = row.player;
    const names = [
      profile.name,
      [profile.firstname, profile.lastname].filter(Boolean).join(' '),
    ].map(canonical);
    const teams = row.statistics.map((s) => canonical(s.team.name));
    const matches = Object.values(players).filter(
      (p) =>
        names.includes(canonical(p.name)) &&
        teams.some((t) => {
          const club = base.clubs.byId[p.clubId ?? ''];
          if (!club) return false;
          const n = canonical(club.name);
          return n === t || (Math.min(n.length, t.length) >= 5 && (n.includes(t) || t.includes(n)));
        }),
    );
    if (matches.length !== 1) continue;
    const player = matches[0]!;
    players[player.id] = {
      ...player,
      ...(profile.age && profile.age >= 16 && profile.age <= 100 ? { age: profile.age } : {}),
    };
    updated++;
  }
  if (!updated) return base;
  return worldDatasetSchema.parse({
    ...base,
    players: { ...base.players, byId: players },
    source: (
      base.source.replace(/ · API-Football.*$/, '') + ' · API-Football (perfis parciais de 2026)'
    ).slice(0, 200),
  });
}

export class ApiFootballDataProvider implements DataProvider {
  private readonly fallbackPath: string;
  private readonly ledgerPath: string;
  constructor(
    private readonly fallback: DataProvider,
    private readonly options: {
      key: string;
      directory: string;
      league?: number;
      season?: number;
      dailyLimit?: number;
    },
    private readonly request: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    this.fallbackPath = join(options.directory, 'default.json');
    this.ledgerPath = join(options.directory, 'quota.json');
  }
  /** Catalogs and ordinary reads are always local and never spend API quota. */
  async load(): Promise<Result<WorldDataset>> {
    try {
      return success(
        worldDatasetSchema.parse(JSON.parse(await readFile(this.fallbackPath, 'utf8'))),
      );
    } catch {
      return this.fallback.load();
    }
  }
  async status() {
    try {
      const state = ledgerSchema.parse(JSON.parse(await readFile(this.ledgerPath, 'utf8')));
      return {
        day: state.day,
        requestsReservedOrReported: state.used,
        blocked: state.blocked,
        blockedReason: state.blockedReason ?? null,
      };
    } catch {
      return { day: null, requestsReservedOrReported: 0, blocked: false, blockedReason: null };
    }
  }
  async bootstrap(): Promise<Result<WorldDataset>> {
    return this.refresh('bootstrap');
  }
  async loadForLeague(leagueId: string): Promise<Result<WorldDataset>> {
    return this.refresh('league:' + leagueId);
  }
  private async save(path: string, value: unknown) {
    const temp = path + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify(value), 'utf8');
    await rename(temp, path);
  }
  private async refresh(attempt: string): Promise<Result<WorldDataset>> {
    const base = await this.load();
    if (!base.ok) return base;
    let lock: Awaited<ReturnType<typeof open>> | undefined;
    const lockPath = join(this.options.directory, 'request.lock');
    try {
      await mkdir(this.options.directory, { recursive: true });
      for (let i = 0; i < 25; i++) {
        try {
          lock = await open(lockPath, 'wx');
          break;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
          try {
            if (this.now() - (await stat(lockPath)).mtimeMs > 120000) await unlink(lockPath);
          } catch {
            // Another process may already have removed the stale lock.
          }
          await delay(100);
        }
      }
      if (!lock) return base;
      // Reload after acquiring the lock: another creation may have improved the cache.
      const current = await this.load();
      const dataset = current.ok ? current.value : base.value;
      await this.save(this.fallbackPath, dataset);
      const day = new Date(this.now()).toISOString().slice(0, 10);
      let ledger: z.infer<typeof ledgerSchema>;
      try {
        ledger = ledgerSchema.parse(JSON.parse(await readFile(this.ledgerPath, 'utf8')));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return success(dataset);
        ledger = { day, used: 0, blocked: false, attempted: {} };
      }
      if (ledger.day !== day)
        ledger = { ...ledger, day, used: 0, blocked: false, blockedReason: undefined };
      if (
        ledger.attempted[attempt] ||
        ledger.blocked ||
        ledger.used >= Math.min(100, this.options.dailyLimit ?? 100) ||
        !this.options.key
      )
        return success(dataset);
      // Reserve BEFORE sending. Failures and restarts must not cause retries or extra calls.
      ledger.attempted[attempt] = true;
      ledger.used++;
      await this.save(this.ledgerPath, ledger);
      const url = new URL('https://v3.football.api-sports.io/players');
      url.searchParams.set('league', String(this.options.league ?? 71));
      url.searchParams.set('season', String(this.options.season ?? 2026));
      url.searchParams.set('page', '1');
      const response = await this.request(url, {
        headers: { 'x-apisports-key': this.options.key },
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      const remaining = response.headers.get('x-ratelimit-requests-remaining');
      if (remaining !== null && Number.isFinite(Number(remaining)))
        ledger.used = Math.max(ledger.used, 100 - Number(remaining));
      if (response.status === 429 || remaining === '0') {
        ledger.blocked = true;
        ledger.blockedReason = 'quota';
      }
      await this.save(this.ledgerPath, ledger);
      if (!response.ok) return success(dataset);
      const raw: unknown = await response.json();
      await this.save(join(this.options.directory, 'latest-response.json'), {
        retrievedAt: new Date(this.now()).toISOString(),
        endpoint: url.pathname + url.search,
        payload: raw,
      });
      const parsed = responseSchema.safeParse(raw);
      if (!parsed.success || Object.keys(parsed.data.errors).length) {
        if (
          parsed.success &&
          /limit|quota|requests|plan|season/i.test(JSON.stringify(parsed.data.errors))
        ) {
          ledger.blocked = true;
          ledger.blockedReason = /plan|season/i.test(JSON.stringify(parsed.data.errors))
            ? 'plan'
            : 'quota';
          await this.save(this.ledgerPath, ledger);
        }
        return success(dataset);
      }
      const merged = mergeApiFootball(dataset, parsed.data);
      await this.save(this.fallbackPath, merged);
      return success(merged);
    } catch {
      return base;
    } finally {
      if (lock) {
        await lock.close().catch(() => {});
        await unlink(lockPath).catch(() => {});
      }
    }
  }
}
