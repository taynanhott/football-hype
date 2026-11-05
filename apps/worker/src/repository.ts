import {
  gameEventSchema,
  worldStateSchema,
  matchResultSchema,
  type GameEvent,
  type WorldState,
} from '@football/shared';
import type {
  DrawReservation,
  LeagueRepository,
  LeagueSummary,
  SavedLeague,
} from '../../server/src/repositories/league-repository.js';
import { leagueWakePlan, nextPlannedWake } from './wake-policy.js';
import { jsonObjectArray } from './json-object-array.js';

type SqlStorageValue = string | number | null | ArrayBuffer;
type Mode = 'offline' | 'multiplayer';
export interface SqlStore {
  exec<T extends Record<string, SqlStorageValue> = Record<string, SqlStorageValue>>(
    query: string,
    ...bindings: SqlStorageValue[]
  ): Iterable<T>;
}
/** Chunked branches stay below SQLite's row limit, even for large seasons. */
export class DurableLeagueRepository implements LeagueRepository {
  private readonly replayActions = new Map<
    WorldState['results'][number],
    NonNullable<WorldState['results'][number]['actions']>
  >();
  private cached: SavedLeague | undefined;
  private metadataCache: SavedLeague | undefined;
  constructor(
    private readonly sql: SqlStore,
    private readonly atomic: <T>(fn: () => T) => T,
    private readonly retainEventPatches = true,
  ) {
    sql.exec(
      `CREATE TABLE IF NOT EXISTS leagues(id TEXT PRIMARY KEY, revision INTEGER, mode TEXT, status TEXT, due REAL, summary TEXT)`,
    );
    sql.exec(`CREATE INDEX IF NOT EXISTS leagues_due ON leagues(status,due)`);
    sql.exec(
      `CREATE TABLE IF NOT EXISTS members(user_id TEXT, mode TEXT, league_id TEXT, PRIMARY KEY(user_id,league_id))`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS chunks(league_id TEXT, branch TEXT, part INTEGER, value TEXT, PRIMARY KEY(league_id,branch,part))`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS events(league_id TEXT, sequence INTEGER, metadata TEXT, PRIMARY KEY(league_id,sequence))`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS draws(user_id TEXT, mode TEXT, value TEXT, PRIMARY KEY(user_id,mode))`,
    );
    sql.exec('CREATE TABLE IF NOT EXISTS league_wakes(league_id TEXT PRIMARY KEY, value TEXT)');
  }
  private write(id: string, branch: string, value: unknown) {
    const json = JSON.stringify(value);
    if (json === undefined) {
      this.sql.exec('DELETE FROM chunks WHERE league_id=? AND branch=?', id, branch);
      return;
    }
    // Compare inside SQLite instead of materializing the entire old branch in
    // JS alongside the old world, new world and serialized replacement.
    const count = Math.ceil(json.length / 32768);
    for (let part = 0; part < count; part++) {
      const value = json.slice(part * 32768, (part + 1) * 32768);
      this.sql.exec(
        'INSERT INTO chunks VALUES (?,?,?,?) ON CONFLICT(league_id,branch,part) DO UPDATE SET value=excluded.value WHERE chunks.value<>excluded.value',
        id,
        branch,
        part,
        value,
      );
    }
    this.sql.exec(
      'DELETE FROM chunks WHERE league_id=? AND branch=? AND part>=?',
      id,
      branch,
      count,
    );
  }
  private read(id: string, branch: string): unknown {
    const parts = [
      ...this.sql.exec<{ value: string }>(
        'SELECT value FROM chunks WHERE league_id=? AND branch=? ORDER BY part',
        id,
        branch,
      ),
    ];
    return JSON.parse(parts.map((p) => p.value).join('')) as unknown;
  }
  private readResults(id: string): WorldState['results'] {
    const rows = this.sql.exec<{ value: string }>(
      'SELECT value FROM chunks WHERE league_id=? AND branch=? ORDER BY part',
      id,
      'results',
    );
    function* chunks() {
      for (const row of rows) yield row.value;
    }
    const results: WorldState['results'] = [];
    for (const value of jsonObjectArray(chunks())) {
      const result = matchResultSchema.parse(value);
      if (result.actions?.length) {
        const json = JSON.stringify(result.actions);
        Object.defineProperty(result, 'actions', {
          enumerable: true,
          get: () => {
            let actions = this.replayActions.get(result);
            if (!actions) actions = JSON.parse(json) as NonNullable<typeof result.actions>;
            this.replayActions.delete(result);
            this.replayActions.set(result, actions);
            if (this.replayActions.size > 8)
              this.replayActions.delete(this.replayActions.keys().next().value!);
            return actions;
          },
        });
      }
      results.push(result);
    }
    return results;
  }
  private appendResults(id: string, revision: number, next: WorldState['results']): boolean {
    const previous = this.cached?.state;
    if (
      previous?.id !== id ||
      previous.revision !== revision ||
      next.length < previous.results.length ||
      !previous.results.every((result, index) => result === next[index])
    )
      return false;
    if (next.length === previous.results.length) return true;
    const tail = [
      ...this.sql.exec<{ part: number; value: string }>(
        'SELECT part,value FROM chunks WHERE league_id=? AND branch=? ORDER BY part DESC LIMIT 1',
        id,
        'results',
      ),
    ][0];
    if (!tail?.value.endsWith(']')) return false;
    let part = tail.part;
    let buffer = tail.value.slice(0, -1);
    const flush = () => {
      this.sql.exec(
        'INSERT INTO chunks VALUES (?,?,?,?) ON CONFLICT(league_id,branch,part) DO UPDATE SET value=excluded.value WHERE chunks.value<>excluded.value',
        id,
        'results',
        part++,
        buffer.slice(0, 32768),
      );
      buffer = buffer.slice(32768);
    };
    for (let index = previous.results.length; index < next.length; index++) {
      buffer += (index ? ',' : '') + JSON.stringify(next[index]);
      while (buffer.length >= 32768) flush();
    }
    buffer += ']';
    while (buffer.length) flush();
    return true;
  }
  private check(user: string, mode: Mode, except = '') {
    const rows = [
      ...this.sql.exec(
        'SELECT league_id FROM members WHERE user_id=? AND mode=? AND league_id<>?',
        user,
        mode,
        except,
      ),
    ];
    if (rows.length >= (mode === 'offline' ? 2 : 1))
      throw new Error('Você já possui uma carreira neste modo. Continue sua carreira.');
  }
  private metadata(state: WorldState) {
    const { id, name, mode, season, round, administratorId } = state;
    this.sql.exec(
      'INSERT INTO league_wakes VALUES (?,?) ON CONFLICT(league_id) DO UPDATE SET value=excluded.value',
      id,
      JSON.stringify(leagueWakePlan(state)),
    );
    this.sql.exec(
      `INSERT INTO leagues VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,status=excluded.status,due=excluded.due,summary=excluded.summary`,
      id,
      state.revision,
      mode,
      state.deletedAt ? 'deleted' : state.status,
      state.nextScheduledAt,
      JSON.stringify({
        id,
        name,
        mode,
        season,
        round,
        administratorId,
        clubsByUser: Object.fromEntries(
          state.participants.map((member) => {
            const club = state.clubs.byId[member.clubId];
            return [
              member.userId,
              club ? { id: club.id, name: club.name, crestUrl: club.crestUrl } : undefined,
            ];
          }),
        ),
      }),
    );
    const members = state.deletedAt ? [] : state.participants.map((m) => m.userId);
    const existing = [
      ...this.sql.exec<{ user_id: string }>('SELECT user_id FROM members WHERE league_id=?', id),
    ].map((m) => m.user_id);
    for (const user of existing) {
      if (members.includes(user)) continue;
      this.sql.exec('DELETE FROM members WHERE league_id=? AND user_id=?', id, user);
      this.sql.exec(
        "DELETE FROM draws WHERE user_id=? AND json_extract(value,'$.leagueId')=?",
        user,
        id,
      );
    }
    for (const user of members)
      if (!existing.includes(user))
        this.sql.exec('INSERT INTO members VALUES (?,?,?)', user, mode, id);
  }
  async load(id: string, options?: { eventPatches?: boolean }): Promise<SavedLeague | undefined> {
    const row = [
      ...this.sql.exec('SELECT revision FROM leagues WHERE id=? AND status<>?', id, 'deleted'),
    ][0];
    if (!row) return undefined;
    if (
      options?.eventPatches === false &&
      this.metadataCache?.state.id === id &&
      this.metadataCache.state.revision === row.revision
    )
      return this.metadataCache;
    let state: WorldState;
    if (this.cached?.state.id === id && this.cached.state.revision === row.revision)
      state = this.cached.state;
    else {
      const branches = [
        ...this.sql.exec<{ branch: string }>(
          'SELECT DISTINCT branch FROM chunks WHERE league_id=? AND branch NOT LIKE ?',
          id,
          'event:%',
        ),
      ];
      const stored = new Set(branches.map(({ branch }) => branch));
      if (branches.some(({ branch }) => !Object.hasOwn(worldStateSchema.shape, branch)))
        throw new Error('Dados de carreira inválidos');
      // Validate one branch at a time so raw JSON and its validated copy of the
      // entire career never coexist. Missing branches still receive schema defaults.
      state = Object.fromEntries(
        Object.entries(worldStateSchema.shape).map(([branch, schema]) => [
          branch,
          branch === 'results' && stored.has(branch)
            ? this.readResults(id)
            : schema.parse(stored.has(branch) ? this.read(id, branch) : undefined),
        ]),
      ) as WorldState;
    }
    const events = [
      ...this.sql.exec<{ sequence: number; metadata: string }>(
        'SELECT sequence,metadata FROM events WHERE league_id=? ORDER BY sequence',
        id,
      ),
    ].map((row) =>
      gameEventSchema.parse({
        ...JSON.parse(row.metadata),
        patch:
          !this.retainEventPatches || options?.eventPatches === false
            ? {}
            : this.read(id, `event:${row.sequence}`),
      }),
    );
    this.cached = { state, events };
    if (options?.eventPatches === false) this.metadataCache = this.cached;
    return this.cached;
  }
  async create(state: WorldState): Promise<void> {
    this.atomic(() => {
      if ([...this.sql.exec('SELECT id FROM leagues WHERE id=?', state.id)].length)
        throw new Error('Liga já existe');
      for (const member of state.participants) this.check(member.userId, state.mode);
      this.metadata(state);
      for (const [branch, value] of Object.entries(state)) this.write(state.id, branch, value);
      this.sql.exec(
        'DELETE FROM draws WHERE user_id=? AND mode=?',
        state.administratorId,
        state.mode,
      );
    });
    this.cached = { state, events: [] };
  }
  async append(id: string, revision: number, state: WorldState, event: GameEvent): Promise<void> {
    this.atomic(() => {
      const row = [...this.sql.exec('SELECT revision,status FROM leagues WHERE id=?', id)][0];
      if (
        !row ||
        row.status === 'deleted' ||
        row.revision !== revision ||
        state.id !== id ||
        state.revision !== revision + 1 ||
        event.sequence !== state.revision
      )
        throw new Error('A liga mudou. Atualize e tente novamente');
      for (const member of state.participants) this.check(member.userId, state.mode, id);
      for (const [branch, value] of Object.entries({ ...event.patch, revision: state.revision })) {
        if (branch === 'results' && this.appendResults(id, revision, state.results)) continue;
        this.write(id, branch, value);
      }
      const { patch, ...metadata } = event;
      // Runtime recovery uses the current branches. The ledger needs metadata and
      // request ids, not another full copy of every changed player/management branch.
      if (this.retainEventPatches) this.write(id, `event:${event.sequence}`, patch);
      this.sql.exec(
        'INSERT INTO events VALUES (?,?,?)',
        id,
        event.sequence,
        JSON.stringify(metadata),
      );
      const expired = [
        ...this.sql.exec<{ sequence: number }>(
          'SELECT sequence FROM events WHERE league_id=? AND sequence<=?',
          id,
          event.sequence - 100,
        ),
      ];
      for (const entry of expired)
        this.sql.exec(
          'DELETE FROM chunks WHERE league_id=? AND branch=?',
          id,
          `event:${entry.sequence}`,
        );
      this.sql.exec(
        'DELETE FROM events WHERE league_id=? AND sequence<=?',
        id,
        event.sequence - 100,
      );
      this.metadata(state);
    });
    this.cached = { state, events: [] };
  }
  async getDraw(user: string, mode: Mode): Promise<DrawReservation | undefined> {
    const row = [
      ...this.sql.exec<{ value: string }>(
        'SELECT value FROM draws WHERE user_id=? AND mode=?',
        user,
        mode,
      ),
    ][0];
    return row ? (JSON.parse(row.value) as DrawReservation) : undefined;
  }
  async reserveDraw(user: string, mode: Mode, draw: DrawReservation): Promise<DrawReservation> {
    return this.atomic(() => {
      this.check(user, mode);
      const prior = [
        ...this.sql.exec<{ value: string }>(
          'SELECT value FROM draws WHERE user_id=? AND mode=?',
          user,
          mode,
        ),
      ][0];
      if (prior) return JSON.parse(prior.value) as DrawReservation;
      this.sql.exec('INSERT INTO draws VALUES (?,?,?)', user, mode, JSON.stringify(draw));
      return draw;
    });
  }
  async remove(id: string, user: string, now: number): Promise<void> {
    const saved = await this.load(id, { eventPatches: false });
    if (
      !saved ||
      saved.state.administratorId !== user ||
      !saved.state.participants.some((m) => m.userId === user)
    )
      throw new Error('Somente o administrador pode excluir');
    this.atomic(() => {
      this.metadata({ ...saved.state, deletedAt: now, revision: saved.state.revision + 1 });
      this.sql.exec('DELETE FROM chunks WHERE league_id=?', id);
      this.sql.exec('DELETE FROM events WHERE league_id=?', id);
    });
    this.cached = undefined;
  }
  async summariesForUser(user: string): Promise<readonly LeagueSummary[]> {
    return [
      ...this.sql.exec<{ summary: string }>(
        'SELECT summary FROM leagues JOIN members ON leagues.id=members.league_id WHERE members.user_id=?',
        user,
      ),
    ].map((r) => {
      const { clubsByUser, ...summary } = JSON.parse(r.summary) as LeagueSummary & {
        clubsByUser?: Record<string, unknown>;
      };
      return { ...summary, ...(clubsByUser?.[user] ? { club: clubsByUser[user] } : {}) };
    });
  }
  async forUser(user: string): Promise<readonly WorldState[]> {
    const rows = await this.summariesForUser(user);
    const states: WorldState[] = [];
    for (const row of rows) {
      const saved = await this.load(row.id, { eventPatches: false });
      if (saved) states.push(saved.state);
    }
    return states;
  }
  async active(): Promise<readonly string[]> {
    return [...this.sql.exec<{ id: string }>("SELECT id FROM leagues WHERE status='active'")].map(
      (r) => r.id,
    );
  }
  async wakeDeadlines(now: number): Promise<number[]> {
    const rows = [
      ...this.sql.exec<{ id: string; value: string | null }>(
        "SELECT leagues.id,league_wakes.value FROM leagues LEFT JOIN league_wakes ON leagues.id=league_wakes.league_id WHERE leagues.status='active'",
      ),
    ];
    const deadlines: number[] = [];
    for (const row of rows) {
      let plan: ReturnType<typeof leagueWakePlan>;
      if (row.value) plan = JSON.parse(row.value) as ReturnType<typeof leagueWakePlan>;
      else {
        // Existing careers build this small scheduling index once, without changing their revision.
        const saved = await this.load(row.id, { eventPatches: false });
        if (!saved) continue;
        plan = leagueWakePlan(saved.state);
        this.sql.exec(
          'INSERT OR REPLACE INTO league_wakes VALUES (?,?)',
          row.id,
          JSON.stringify(plan),
        );
      }
      const at = nextPlannedWake(plan, now);
      if (at !== undefined) deadlines.push(at);
    }
    return deadlines;
  }
  async due(now: number): Promise<readonly string[]> {
    return [
      ...this.sql.exec<{ id: string }>(
        "SELECT id FROM leagues WHERE status='active' AND due<=?",
        now,
      ),
    ].map((r) => r.id);
  }
}
