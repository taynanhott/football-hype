import {
  gameEventSchema,
  worldStateSchema,
  type GameEvent,
  type WorldState,
} from '@football/shared';
import type {
  DrawReservation,
  LeagueRepository,
  LeagueSummary,
  SavedLeague,
} from '../../server/src/repositories/league-repository.js';

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
  private cached: SavedLeague | undefined;
  constructor(
    private readonly sql: SqlStore,
    private readonly atomic: <T>(fn: () => T) => T,
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
  }
  private write(id: string, branch: string, value: unknown) {
    const json = JSON.stringify(value);
    if (json === undefined) throw new Error('Estado inválido');
    this.sql.exec('DELETE FROM chunks WHERE league_id=? AND branch=?', id, branch);
    for (let offset = 0; offset < json.length; offset += 32768)
      this.sql.exec(
        'INSERT INTO chunks VALUES (?,?,?,?)',
        id,
        branch,
        offset / 32768,
        json.slice(offset, offset + 32768),
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
      `INSERT INTO leagues VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,status=excluded.status,due=excluded.due,summary=excluded.summary`,
      id,
      state.revision,
      mode,
      state.deletedAt ? 'deleted' : state.status,
      state.nextScheduledAt,
      JSON.stringify({ id, name, mode, season, round, administratorId }),
    );
    this.sql.exec('DELETE FROM members WHERE league_id=?', id);
    if (!state.deletedAt)
      for (const member of state.participants)
        this.sql.exec('INSERT INTO members VALUES (?,?,?)', member.userId, mode, id);
    this.sql.exec(
      `DELETE FROM draws WHERE json_extract(value,'$.leagueId')=? AND NOT EXISTS(SELECT 1 FROM members WHERE members.user_id=draws.user_id AND members.league_id=?)`,
      id,
      id,
    );
  }
  async load(id: string, options?: { eventPatches?: boolean }): Promise<SavedLeague | undefined> {
    const row = [
      ...this.sql.exec('SELECT revision FROM leagues WHERE id=? AND status<>?', id, 'deleted'),
    ][0];
    if (!row) return undefined;
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
      state = worldStateSchema.parse(
        Object.fromEntries(branches.map(({ branch }) => [branch, this.read(id, branch)])),
      );
    }
    const events = [
      ...this.sql.exec<{ sequence: number; metadata: string }>(
        'SELECT sequence,metadata FROM events WHERE league_id=? ORDER BY sequence',
        id,
      ),
    ].map((row) =>
      gameEventSchema.parse({
        ...JSON.parse(row.metadata),
        patch: options?.eventPatches === false ? {} : this.read(id, `event:${row.sequence}`),
      }),
    );
    this.cached = { state, events };
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
      for (const [branch, value] of Object.entries({ ...event.patch, revision: state.revision }))
        this.write(id, branch, value);
      const { patch, ...metadata } = event;
      this.write(id, `event:${event.sequence}`, patch);
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
    ].map((r) => JSON.parse(r.summary) as LeagueSummary);
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
  async due(now: number): Promise<readonly string[]> {
    return [
      ...this.sql.exec<{ id: string }>(
        "SELECT id FROM leagues WHERE status='active' AND due<=?",
        now,
      ),
    ].map((r) => r.id);
  }
}
