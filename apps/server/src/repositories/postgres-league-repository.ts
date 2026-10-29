import { Pool, type PoolClient } from 'pg';
import {
  gameEventSchema,
  worldStateSchema,
  type GameEvent,
  type WorldState,
} from '@football/shared';
import type {
  LeagueRepository,
  SavedLeague,
  LeagueSummary,
  DrawReservation,
} from './league-repository.js';

type Mode = 'offline' | 'multiplayer';
/** PostgreSQL is the source of truth; patches update only changed top-level branches. */
export class PostgresLeagueRepository implements LeagueRepository {
  private readonly pool: Pool;
  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 8,
      connectionTimeoutMillis: 10000,
      statement_timeout: 30000,
    });
    this.pool.on('error', (error) => console.error('Conexão PostgreSQL interrompida', error));
  }
  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS football_leagues (
        id text PRIMARY KEY, revision integer NOT NULL, state jsonb NOT NULL,
        participant_ids text[] NOT NULL, mode text NOT NULL, status text NOT NULL,
        next_scheduled_at bigint NOT NULL
      );
      CREATE INDEX IF NOT EXISTS football_leagues_members ON football_leagues USING gin(participant_ids);
      CREATE INDEX IF NOT EXISTS football_leagues_due ON football_leagues(next_scheduled_at) WHERE status = 'active';
      CREATE TABLE IF NOT EXISTS football_events (
        league_id text NOT NULL REFERENCES football_leagues(id) ON DELETE CASCADE,
        sequence integer NOT NULL, event jsonb NOT NULL, PRIMARY KEY(league_id, sequence)
      );
      CREATE TABLE IF NOT EXISTS football_draws (
        user_id text NOT NULL, mode text NOT NULL, draw jsonb NOT NULL, PRIMARY KEY(user_id, mode)
      );
    `);
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize membership changes across processes, including joins and draw reservations.
      await client.query('SELECT pg_advisory_xact_lock(742019)');
      const value = await operation(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  private async checkMembership(client: PoolClient, userId: string, mode: Mode, except = '') {
    const result = await client.query<{ count: string }>(
      `SELECT count(*) FROM football_leagues WHERE participant_ids @> ARRAY[$1]::text[] AND mode=$2 AND id<>$3 AND status<>'deleted'`,
      [userId, mode, except],
    );
    if (Number(result.rows[0]!.count) >= (mode === 'offline' ? 2 : 1))
      throw new Error('Você já participa de uma liga deste modo');
  }
  async load(id: string, options?: { eventPatches?: boolean }): Promise<SavedLeague | undefined> {
    // One statement gives a consistent state/history snapshot even during concurrent writes.
    const result = await this.pool.query<{ state: unknown; events: unknown[] }>(
      `
      SELECT l.state, COALESCE((SELECT jsonb_agg(CASE WHEN $2::boolean THEN e.event ELSE (e.event - 'patch') || '{"patch":{}}'::jsonb END ORDER BY e.sequence)
        FROM football_events e WHERE e.league_id=l.id), '[]'::jsonb) AS events
      FROM football_leagues l WHERE l.id=$1 AND l.status<>'deleted'`,
      [id, options?.eventPatches !== false],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      state: worldStateSchema.parse(row.state),
      events: row.events.map((value) => {
        const event = gameEventSchema.parse(value);
        return options?.eventPatches === false ? { ...event, patch: {} } : event;
      }),
    };
  }
  async create(state: WorldState): Promise<void> {
    await this.transaction(async (client) => {
      for (const member of state.participants)
        await this.checkMembership(client, member.userId, state.mode);
      await client.query('INSERT INTO football_leagues VALUES ($1,$2,$3,$4,$5,$6,$7)', [
        state.id,
        state.revision,
        JSON.stringify(state),
        state.participants.map((m) => m.userId),
        state.mode,
        state.status,
        state.nextScheduledAt,
      ]);
      await client.query('DELETE FROM football_draws WHERE user_id=$1 AND mode=$2', [
        state.administratorId,
        state.mode,
      ]);
    });
  }
  async append(
    id: string,
    expectedRevision: number,
    state: WorldState,
    event: GameEvent,
  ): Promise<void> {
    if (
      state.id !== id ||
      state.revision !== expectedRevision + 1 ||
      event.sequence !== state.revision
    )
      throw new Error('Revisão da liga inválida');
    await this.transaction(async (client) => {
      for (const member of state.participants)
        await this.checkMembership(client, member.userId, state.mode, id);
      const result = await client.query(
        `UPDATE football_leagues SET revision=$2,
        state=state || $3::jsonb, participant_ids=$4, mode=$5, status=$6, next_scheduled_at=$7
        WHERE id=$1 AND revision=$8 AND status<>'deleted'`,
        [
          id,
          state.revision,
          JSON.stringify({ ...event.patch, revision: state.revision }),
          state.deletedAt ? [] : state.participants.map((m) => m.userId),
          state.mode,
          state.deletedAt ? 'deleted' : state.status,
          state.nextScheduledAt,
          expectedRevision,
        ],
      );
      if (result.rowCount !== 1) throw new Error('A liga mudou. Atualize e tente novamente');
      await client.query('INSERT INTO football_events VALUES ($1,$2,$3)', [
        id,
        event.sequence,
        JSON.stringify(event),
      ]);
      await client.query('DELETE FROM football_events WHERE league_id=$1 AND sequence <= $2', [
        id,
        event.sequence - 100,
      ]);
      await client.query(
        `DELETE FROM football_draws WHERE draw->>'leagueId'=$1 AND (NOT(user_id=ANY($2::text[])) OR $3)`,
        [id, state.participants.map((m) => m.userId), Boolean(state.deletedAt)],
      );
    });
  }
  async getDraw(userId: string, mode: Mode): Promise<DrawReservation | undefined> {
    const result = await this.pool.query<{ draw: DrawReservation }>(
      'SELECT draw FROM football_draws WHERE user_id=$1 AND mode=$2',
      [userId, mode],
    );
    return result.rows[0]?.draw;
  }
  async reserveDraw(userId: string, mode: Mode, draw: DrawReservation): Promise<DrawReservation> {
    return this.transaction(async (client) => {
      await this.checkMembership(client, userId, mode);
      const result = await client.query<{ draw: DrawReservation }>(
        `INSERT INTO football_draws VALUES ($1,$2,$3)
        ON CONFLICT(user_id,mode) DO UPDATE SET draw=football_draws.draw RETURNING draw`,
        [userId, mode, JSON.stringify(draw)],
      );
      return result.rows[0]!.draw;
    });
  }
  async remove(id: string, userId: string, now: number): Promise<void> {
    await this.transaction(async (client) => {
      const result = await client.query(
        `UPDATE football_leagues SET status='deleted', participant_ids='{}', revision=revision+1,
        state=state || jsonb_build_object('deletedAt',$3::bigint,'revision',revision+1)
        WHERE id=$1 AND state->>'administratorId'=$2 AND participant_ids @> ARRAY[$2]::text[] AND status<>'deleted'`,
        [id, userId, now],
      );
      if (result.rowCount !== 1) throw new Error('Somente o administrador pode excluir');
      await client.query(`DELETE FROM football_draws WHERE draw->>'leagueId'=$1`, [id]);
    });
  }
  async summariesForUser(userId: string): Promise<readonly LeagueSummary[]> {
    const result = await this.pool.query<{ summary: LeagueSummary }>(
      `SELECT jsonb_build_object(
      'id',id,'name',state->'name','mode',mode,'season',state->'season','round',state->'round',
      'administratorId',state->'administratorId') AS summary FROM football_leagues
      WHERE participant_ids @> ARRAY[$1]::text[] AND status<>'deleted'`,
      [userId],
    );
    return result.rows.map((row) => row.summary);
  }
  async forUser(userId: string): Promise<readonly WorldState[]> {
    const result = await this.pool.query<{ state: unknown }>(
      `SELECT state FROM football_leagues WHERE participant_ids @> ARRAY[$1]::text[] AND status<>'deleted'`,
      [userId],
    );
    return result.rows.map((row) => worldStateSchema.parse(row.state));
  }
  async active(): Promise<readonly string[]> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM football_leagues WHERE status='active'`,
    );
    return result.rows.map((row) => row.id);
  }
  async due(now: number): Promise<readonly string[]> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM football_leagues WHERE status='active' AND next_scheduled_at <= $1`,
      [now],
    );
    return result.rows.map((row) => row.id);
  }
}
