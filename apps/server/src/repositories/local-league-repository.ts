import { createHash } from 'node:crypto';
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
  stat,
  truncate,
  unlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { gzip, gunzipSync } from 'node:zlib';
import { promisify } from 'node:util';
const compress = promisify(gzip);
import {
  gameEventSchema,
  worldStateSchema,
  type GameEvent,
  type WorldState,
} from '@football/shared';
import type { LeagueRepository, SavedLeague, DrawReservation } from './league-repository.js';

export class LocalLeagueRepository implements LeagueRepository {
  private readonly draws = new Map<string, DrawReservation>();
  private readonly leagues = new Map<string, SavedLeague>();
  private readonly fileVersions = new Map<string, string>();
  private readonly operations = new Map<string, Promise<unknown>>();
  constructor(private readonly directory: string | undefined) {}
  async initialize(): Promise<void> {
    if (!this.directory) return;
    await mkdir(this.directory, { recursive: true });
    for (const file of await readdir(this.directory)) {
      if (!file.endsWith('.json.gz')) continue;
      await this.load(file.slice(0, -'.json.gz'.length));
    }
  }
  async load(id: string): Promise<SavedLeague | undefined> {
    return this.serial(id, () => this.read(id));
  }
  private async read(id: string): Promise<SavedLeague | undefined> {
    if (this.directory && /^[a-f0-9-]{36}$/.test(id)) {
      const file = join(this.directory, `${id}.json.gz`);
      try {
        const info = await stat(file);
        const journal = `${file}.events`;
        const journalInfo = await stat(journal).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error;
          return undefined;
        });
        const version = `${info.mtimeMs}:${info.size}:${journalInfo?.mtimeMs ?? 0}:${journalInfo?.size ?? 0}`;
        if (this.fileVersions.get(id) !== version) {
          const saved = JSON.parse(gunzipSync(await readFile(file)).toString('utf8')) as {
            state: unknown;
            events: unknown[];
          };
          let state = worldStateSchema.parse(saved.state);
          if (state.id !== id) throw new Error('O arquivo da liga tem identificação inválida');
          const events = saved.events.map((event) => gameEventSchema.parse(event));
          if (journalInfo) {
            const bytes = await readFile(journal);
            const end = bytes.lastIndexOf(10) + 1;
            // An interrupted append can leave an incomplete final record.
            if (end < bytes.length) await truncate(journal, end);
            for (const line of bytes.subarray(0, end).toString('utf8').split('\n')) {
              if (!line) continue;
              const event = gameEventSchema.parse(JSON.parse(line));
              if (event.sequence <= state.revision) continue;
              if (event.sequence !== state.revision + 1)
                throw new Error('Histórico da liga incompleto');
              state = Object.assign({}, state, event.patch, { revision: event.sequence });
              events.push(event);
            }
            state = worldStateSchema.parse(state);
          }
          this.leagues.set(id, {
            state,
            events,
          });
          this.fileVersions.set(id, version);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return this.leagues.get(id);
  }
  private drawKey(userId: string, mode: string) {
    return createHash('sha256')
      .update(userId + ':' + mode)
      .digest('hex');
  }
  async getDraw(
    userId: string,
    mode: 'offline' | 'multiplayer',
  ): Promise<DrawReservation | undefined> {
    const key = this.drawKey(userId, mode);
    if (this.directory) {
      try {
        return JSON.parse(
          await readFile(join(this.directory, key + '.draw.json'), 'utf8'),
        ) as DrawReservation;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return this.draws.get(key);
  }
  async reserveDraw(
    userId: string,
    mode: 'offline' | 'multiplayer',
    draw: DrawReservation,
  ): Promise<DrawReservation> {
    const key = this.drawKey(userId, mode);
    return this.serial('draw:' + key, async () => {
      if ((await this.forUser(userId)).some((state) => state.mode === mode))
        throw new Error('Você já possui uma carreira neste modo. Continue sua carreira.');
      const previous = await this.getDraw(userId, mode);
      if (previous) return previous;
      if (this.directory) {
        const file = join(this.directory, key + '.draw.json');
        try {
          await writeFile(file, JSON.stringify(draw), { flag: 'wx' });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          return (await this.getDraw(userId, mode))!;
        }
      }
      this.draws.set(key, draw);
      return draw;
    });
  }
  async create(state: WorldState): Promise<void> {
    if (
      this.leagues.has(state.id) ||
      [...this.leagues.values()].some(
        (league) =>
          !league.state.deletedAt &&
          league.state.mode === state.mode &&
          league.state.participants.some((member) => member.userId === state.administratorId),
      )
    )
      throw new Error('Você já participa de uma liga deste modo');
    const saved = { state, events: [] };
    await this.persist(saved);
    this.leagues.set(state.id, saved);
  }
  async append(
    id: string,
    expectedRevision: number,
    state: WorldState,
    event: GameEvent,
  ): Promise<void> {
    await this.serial(id, () => this.appendEvent(id, expectedRevision, state, event));
  }
  private async appendEvent(
    id: string,
    expectedRevision: number,
    state: WorldState,
    event: GameEvent,
  ): Promise<void> {
    const previous = this.leagues.get(id);
    if (!previous || previous.state.revision !== expectedRevision)
      throw new Error('A liga mudou. Atualize e tente novamente');
    for (const member of state.participants) {
      if (
        [...this.leagues.values()].some(
          (league) =>
            league.state.id !== id &&
            league.state.mode === state.mode &&
            league.state.participants.some((participant) => participant.userId === member.userId),
        )
      )
        throw new Error('Você já participa de uma liga deste modo');
    }
    const saved = { state, events: [...previous.events, event] };
    if (this.directory) {
      // Checkpoint before the next command, so a failed checkpoint never confirms it.
      if (previous.events.length > 0 && previous.events.length % 128 === 0) {
        await this.persist(previous);
        await writeFile(join(this.directory, `${id}.json.gz.events`), '');
      }
      await appendFile(join(this.directory, `${id}.json.gz.events`), `${JSON.stringify(event)}\n`);
      const file = join(this.directory, `${id}.json.gz`);
      const [base, journal] = await Promise.all([stat(file), stat(`${file}.events`)]);
      this.fileVersions.set(id, `${base.mtimeMs}:${base.size}:${journal.mtimeMs}:${journal.size}`);
    }
    this.leagues.set(id, saved);
    for (const member of previous.state.participants.filter(
      (member) =>
        state.deletedAt || !state.participants.some((current) => current.userId === member.userId),
    )) {
      const draw = await this.getDraw(member.userId, state.mode);
      if (draw?.leagueId !== id) continue;
      const key = this.drawKey(member.userId, state.mode);
      this.draws.delete(key);
      if (this.directory)
        await unlink(join(this.directory, key + '.draw.json')).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          },
        );
    }
  }
  async forUser(userId: string): Promise<readonly WorldState[]> {
    return [...this.leagues.values()]
      .filter(
        (league) =>
          !league.state.deletedAt &&
          league.state.participants.some((member) => member.userId === userId),
      )
      .map((league) => league.state);
  }
  async active(): Promise<readonly string[]> {
    return [...this.leagues.values()]
      .filter((l) => !l.state.deletedAt && l.state.status === 'active')
      .map((l) => l.state.id);
  }
  async due(now: number): Promise<readonly string[]> {
    return [...this.leagues.values()]
      .filter(
        (league) =>
          !league.state.deletedAt &&
          league.state.status === 'active' &&
          league.state.nextScheduledAt <= now,
      )
      .map((league) => league.state.id);
  }
  private async persist(saved: SavedLeague): Promise<void> {
    if (!this.directory) return;
    const file = join(this.directory, `${saved.state.id}.json.gz`);
    await writeFile(`${file}.tmp`, await compress(JSON.stringify(saved)));
    await rename(`${file}.tmp`, file);
    const info = await stat(file);
    this.fileVersions.set(saved.state.id, `${info.mtimeMs}:${info.size}:0:0`);
  }
  private async serial<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operations.get(id) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.operations.set(id, current);
    try {
      return await current;
    } finally {
      if (this.operations.get(id) === current) this.operations.delete(id);
    }
  }
}
