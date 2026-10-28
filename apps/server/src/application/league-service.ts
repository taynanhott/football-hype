import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  applyEvent,
  playNextBatch,
  createWorld,
  EventBus,
  executeCommand,
  nextRealMatchTime,
  recordEvent,
  SearchTrie,
  standings,
  cupGroupTables,
  importDataset,
  initializeStartingChemistry,
  seasonStart,
  seasonSchedule,
  SEASON_CALENDAR_VERSION,
  type DataProvider,
} from '@football/domain';
import {
  MATCH_DURATION_MS,
  commandSchema,
  connectOptionsSchema,
  COMPETITIONS,
  type GameSnapshot,
} from '@football/shared';
import type { LeagueRepository } from '../repositories/league-repository.js';
import type { Identity } from '../auth/identity.js';

export class LeagueService {
  private readonly searchIndexes = new WeakMap<object, SearchTrie>();
  readonly updates = new EventBus<string>();
  private readonly queues = new Map<string, Promise<unknown>>();
  constructor(
    private readonly repository: LeagueRepository,
    private readonly now: () => number = Date.now,
    private readonly dataProvider?: DataProvider,
  ) {}
  async catalog() {
    let source = 'Base demonstrativa';
    let clubs;
    if (this.dataProvider) {
      const loaded = await this.dataProvider.load();
      if (!loaded.ok) throw new Error(loaded.error.message);
      clubs = Object.values(loaded.value.clubs.byId);
      source = loaded.value.source;
    } else {
      const generated = createWorld({
        id: '00000090-0000-4000-8000-000000000001',
        userId: 'catalog',
        name: 'Catálogo',
        mode: 'offline',
        now: this.now(),
      });
      if (!generated.ok) throw new Error(generated.error.message);
      clubs = Object.values(generated.value.clubs.byId);
    }
    return {
      source,
      imported: Boolean(this.dataProvider),
      clubs: clubs
        .filter((club) => club.country === 'BR')
        .map(({ id, name, division, crestUrl }) => ({
          id,
          name,
          division,
          ...(crestUrl ? { crestUrl } : {}),
        })),
    };
  }
  async create(identity: Identity, input: unknown): Promise<string> {
    return this.serial(`membership:${identity.userId}`, async () => {
      const options = connectOptionsSchema.parse(input);
      const current = (await this.repository.forUser(identity.userId)).find(
        (league) => league.mode === options.mode,
      );
      if (current) return current.id;
      const generated = createWorld({
        id: randomUUID(),
        userId: identity.userId,
        name: options.name,
        mode: options.mode,
        now: this.now(),
        ...(options.clubId ? { clubId: options.clubId } : {}),
      });
      if (!generated.ok) throw new Error(generated.error.message);
      let state = generated.value;
      if (this.dataProvider) {
        const loaded = this.dataProvider.loadForLeague
          ? await this.dataProvider.loadForLeague(state.id)
          : await this.dataProvider.load();
        if (!loaded.ok) throw new Error(loaded.error.message);
        const imported = importDataset(state, loaded.value);
        if (!imported.ok) throw new Error(imported.error.message);
        state = imported.value;
        if (options.assignment !== 'random' && options.clubId) {
          const selected = state.clubs.byId[options.clubId];
          if (!selected || selected.country !== 'BR')
            throw new Error('Escolha um clube da base disponível');
          state.participants = [{ userId: identity.userId, clubId: selected.id, ready: false }];
        }
      }
      if (options.assignment === 'random') {
        const available = state.clubs.ids.filter((id) => state.clubs.byId[id]?.country === 'BR');
        const clubId = available[Math.floor(Math.random() * available.length)];
        if (clubId) state.participants = [{ userId: identity.userId, clubId, ready: false }];
      }
      state = {
        ...state,
        inviteCode: randomUUID(),
        participants: state.participants.map((member) => ({ ...member, lastSeenAt: this.now() })),
      };
      await this.repository.create(state);
      return state.id;
    });
  }
  async list(userId: string) {
    for (const state of await this.repository.forUser(userId)) await this.expire(state.id);
    return (await this.repository.forUser(userId)).map((state) => ({
      id: state.id,
      name: state.name,
      mode: state.mode,
      season: state.season,
      round: state.round,
      administratorId: state.administratorId,
    }));
  }
  async join(leagueId: string, identity: Identity, _clubId?: string): Promise<void> {
    void _clubId;
    await this.touch(leagueId, identity.userId);
  }
  private async commit(
    previous: import('@football/shared').WorldState,
    next: import('@football/shared').WorldState,
    actorId: string,
    message: string,
  ) {
    const event = recordEvent(previous, next, {
      id: randomUUID(),
      occurredAt: this.now(),
      actorId,
      type: 'league.updated',
      message,
      amount: 0,
    });
    if (!event.ok) throw new Error(event.error.message);
    const applied = applyEvent(previous, event.value);
    if (!applied.ok) throw new Error(applied.error.message);
    await this.repository.append(previous.id, previous.revision, applied.value, event.value);
    this.updates.emit(previous.id);
  }
  private async expire(id: string) {
    await this.serial(id, async () => {
      const saved = await this.repository.load(id);
      if (!saved || saved.state.deletedAt || saved.state.mode !== 'multiplayer') return;
      const state = saved.state;
      const participants = state.participants.map((p) =>
        p.lastSeenAt === undefined ? { ...p, lastSeenAt: this.now() } : p,
      );
      if (!state.inviteCode || state.participants.some((p) => p.lastSeenAt === undefined))
        await this.commit(
          state,
          {
            ...state,
            inviteCode: state.inviteCode ?? randomUUID(),
            participants,
            administratorId: participants.some((p) => p.userId === state.administratorId)
              ? state.administratorId
              : (participants[0]?.userId ?? state.administratorId),
          },
          state.administratorId,
          'Participantes e convite da liga atualizados',
        );
    });
  }
  async touch(id: string, userId: string) {
    await this.expire(id);
    await this.serial(id, async () => {
      const saved = await this.repository.load(id);
      const state = saved?.state;
      const member = state?.participants.find((p) => p.userId === userId);
      if (!state || state.deletedAt || !member)
        throw new Error('Acesso negado. Solicite entrada por convite e aguarde aprovação');
      if (this.now() - (member.lastSeenAt ?? 0) < 60000) return;
      await this.commit(
        state,
        {
          ...state,
          participants: state.participants.map((p) =>
            p.userId === userId ? { ...p, lastSeenAt: this.now() } : p,
          ),
        },
        userId,
        'Presença atualizada',
      );
    });
  }
  async invitation(id: string, input: unknown) {
    const { code } = z.object({ code: z.string() }).parse(input);
    await this.expire(id);
    const state = (await this.repository.load(id))?.state;
    if (!state || state.deletedAt || state.mode !== 'multiplayer' || state.inviteCode !== code)
      throw new Error('Convite inválido');
    return {
      admission: state.admission,
      clubs: state.clubs.ids.flatMap((id) => {
        try {
          const club = this.availableClub(state, id);
          return [{ id: club.id, name: club.name, division: club.division }];
        } catch {
          return [];
        }
      }),
    };
  }
  async requestEntry(id: string, identity: Identity, input: unknown) {
    const data = z.object({ code: z.string(), clubId: z.uuid().optional() }).parse(input);
    await this.expire(id);
    await this.serial(id, async () => {
      const state = (await this.repository.load(id))?.state;
      if (
        !state ||
        state.deletedAt ||
        state.mode !== 'multiplayer' ||
        data.code !== state.inviteCode
      )
        throw new Error('Convite inválido');
      if (state.participants.some((p) => p.userId === identity.userId)) return;
      if (state.requests.length >= 100) throw new Error('Limite de solicitações atingido');
      if (data.clubId && state.admission.assignment === 'chosen')
        this.availableClub(state, data.clubId);
      await this.commit(
        state,
        {
          ...state,
          requests: [
            ...state.requests.filter((p) => p.userId !== identity.userId),
            {
              userId: identity.userId,
              requestedAt: this.now(),
              ...(data.clubId ? { clubId: data.clubId } : {}),
            },
          ],
        },
        identity.userId,
        'Nova solicitação de entrada',
      );
    });
  }
  private availableClub(state: import('@football/shared').WorldState, id: string) {
    const club = state.clubs.byId[id];
    if (
      !club ||
      club.country !== 'BR' ||
      (state.admission.division && club.division !== state.admission.division) ||
      state.participants.some((p) => p.clubId === id)
    )
      throw new Error('Clube indisponível na divisão permitida');
    return club;
  }
  async decide(id: string, identity: Identity, input: unknown) {
    const data = z
      .object({ userId: z.string(), approve: z.boolean(), clubId: z.uuid().optional() })
      .parse(input);
    await this.serial(`membership:${data.userId}`, () =>
      this.serial(id, async () => {
        const state = (await this.repository.load(id))?.state;
        if (!state || state.deletedAt || state.administratorId !== identity.userId)
          throw new Error('Somente o administrador pode aprovar');
        const request = state.requests.find((p) => p.userId === data.userId);
        if (!request) throw new Error('Solicitação não encontrada');
        let next = { ...state, requests: state.requests.filter((p) => p.userId !== data.userId) };
        if (data.approve) {
          const available = state.clubs.ids.filter((id) => {
            try {
              this.availableClub(state, id);
              return true;
            } catch {
              return false;
            }
          });
          const chosen =
            state.admission.assignment === 'random'
              ? available[Math.floor(Math.random() * available.length)]
              : (data.clubId ?? request.clubId);
          if (!chosen) throw new Error('Escolha um clube disponível ou use sorteio');
          this.availableClub(state, chosen);
          next = {
            ...next,
            participants: [
              ...state.participants,
              { userId: data.userId, clubId: chosen, ready: false, lastSeenAt: this.now() },
            ],
          };
        }
        await this.commit(
          state,
          next,
          identity.userId,
          data.approve ? 'Entrada aprovada' : 'Entrada recusada',
        );
      }),
    );
  }
  async leave(id: string, userId: string, remove = false) {
    await this.serial(id, async () => {
      const state = (await this.repository.load(id))?.state;
      if (!state || state.deletedAt || !state.participants.some((p) => p.userId === userId))
        throw new Error('Acesso negado');
      if (remove && state.administratorId !== userId)
        throw new Error('Somente o administrador pode excluir');
      if (!remove && state.mode === 'offline')
        throw new Error('Use excluir para uma carreira solo');
      const participants = remove ? [] : state.participants.filter((p) => p.userId !== userId);
      await this.commit(
        state,
        {
          ...state,
          participants,
          requests: remove ? [] : state.requests,
          administratorId: participants.some((p) => p.userId === state.administratorId)
            ? state.administratorId
            : (participants[0]?.userId ?? state.administratorId),
          ...(remove ? { deletedAt: this.now() } : {}),
        },
        userId,
        remove ? 'Liga excluída' : 'Treinador abandonou a liga; bot assumiu o clube',
      );
    });
  }
  async snapshot(id: string, userId: string, roomId = ''): Promise<GameSnapshot> {
    await this.expire(id);
    let saved = await this.repository.load(id);
    if (
      !saved ||
      saved.state.deletedAt ||
      !saved.state.participants.some((member) => member.userId === userId)
    )
      throw new Error('Acesso negado');
    if (
      saved.state.round === 0 &&
      saved.state.results.length === 0 &&
      !saved.state.seasonArchives?.length &&
      Object.values(saved.state.chemistry).every((players) => Object.keys(players).length === 0)
    ) {
      await this.serial(id, async () => {
        const current = await this.repository.load(id);
        if (
          !current ||
          current.state.round !== 0 ||
          current.state.results.length ||
          current.state.seasonArchives?.length ||
          Object.values(current.state.chemistry).some((players) => Object.keys(players).length)
        )
          return;
        await this.commit(
          current.state,
          initializeStartingChemistry(current.state),
          userId,
          'Entrosamento inicial dos titulares restaurado',
        );
      });
      saved = (await this.repository.load(id)) ?? saved;
    }
    if (
      saved.state.round === 0 &&
      !saved.state.results.length &&
      saved.state.competitionRulesVersion !== SEASON_CALENDAR_VERSION
    ) {
      await this.serial(id, async () => {
        const current = await this.repository.load(id);
        if (
          !current ||
          current.state.round !== 0 ||
          current.state.results.length ||
          current.state.competitionRulesVersion === SEASON_CALENDAR_VERSION
        )
          return;
        const clock = seasonStart(current.state.season);
        const offset = clock - current.state.lastProcessedAt;
        const next = {
          ...current.state,
          ...seasonSchedule(Object.values(current.state.clubs.byId), clock),
          ...(current.state.seasonClock ? { nextScheduledAt: current.state.nextScheduledAt } : {}),
          createdAt: clock,
          lastProcessedAt: clock,
          management: {
            ...current.state.management,
            contracts: Object.fromEntries(
              Object.entries(current.state.management?.contracts ?? {}).map(([player, end]) => [
                player,
                end + offset,
              ]),
            ),
          },
        };
        await this.commit(
          current.state,
          initializeStartingChemistry(next),
          userId,
          'Calendário da temporada ajustado para 11 de janeiro',
        );
      });
      saved = (await this.repository.load(id)) ?? saved;
    }
    const state = saved.state;
    const tables = Object.fromEntries(
      COMPETITIONS.filter((rule) => rule.format === 'league').map((rule) => [
        rule.id,
        [
          ...standings(
            state.clubs.ids.filter(
              (clubId) => state.clubs.byId[clubId]?.division === rule.division,
            ),
            state.fixtures.filter((fixture) => fixture.competitionId === rule.id && !fixture.group),
            state.results,
            rule.tieBreakers,
          ),
        ],
      ]),
    );
    for (const rule of COMPETITIONS.filter((item) => item.groupSize || item.id === 'serie-c')) {
      for (const group of cupGroupTables(state, rule.id))
        tables[`${rule.id}:group:${group.group}`] = [...group.table];
    }
    return {
      state,
      serverTime: this.now(),
      tables,
      roomId,
      ledger: saved.events.slice(-100).map((event) => ({
        id: event.id,
        sequence: event.sequence,
        occurredAt: event.occurredAt,
        actorId: event.actorId,
        type: event.type,
        message: event.message,
        amount: event.amount,
        ...(event.balances ? { balances: event.balances } : {}),
      })),
    };
  }
  async command(id: string, userId: string, input: unknown, scheduled = false): Promise<void> {
    if (!scheduled) await this.touch(id, userId);
    await this.serial(id, async () => {
      const saved = await this.repository.load(id);
      if (!saved || saved.state.deletedAt) throw new Error('Liga não encontrada');
      if (
        scheduled &&
        (saved.state.status !== 'active' || saved.state.nextScheduledAt > this.now())
      )
        return;
      const command = commandSchema.parse(input);
      if (
        (command.type === 'advance' || command.type === 'ready') &&
        saved.state.mode === 'multiplayer' &&
        saved.state.results.some(
          (result) => (result.startedAt ?? 0) + MATCH_DURATION_MS > this.now(),
        )
      )
        throw new Error('Aguarde o encerramento dos 90 segundos da rodada');
      const event = executeCommand(saved.state, command, userId, this.now(), randomUUID());
      if (!event.ok) throw new Error(event.error.message);
      const applied = applyEvent(saved.state, event.value);
      if (!applied.ok) throw new Error(applied.error.message);
      await this.repository.append(id, saved.state.revision, applied.value, event.value);
      this.updates.emit(id);
      if (
        command.type === 'ready' &&
        applied.value.status === 'active' &&
        applied.value.participants.filter((member) => member.ready).length >
          applied.value.participants.length / 2
      ) {
        const accelerated = executeCommand(
          applied.value,
          { type: 'advance' },
          userId,
          this.now(),
          randomUUID(),
        );
        if (accelerated.ok) {
          const state = applyEvent(applied.value, accelerated.value);
          if (state.ok) {
            await this.repository.append(
              id,
              applied.value.revision,
              state.value,
              accelerated.value,
            );
            this.updates.emit(id);
          }
        }
      }
    });
  }
  async tick(): Promise<void> {
    for (const id of await this.repository.online()) {
      await this.expire(id);
      await this.serial(id, async () => {
        const saved = await this.repository.load(id);
        if (!saved || saved.state.seasonClock || saved.state.status !== 'active') return;
        await this.commit(
          saved.state,
          {
            ...saved.state,
            seasonClock: 1,
            nextScheduledAt: nextRealMatchTime(this.now()),
          },
          saved.state.administratorId,
          'Relógio online ativado',
        );
      });
    }
    for (const id of await this.repository.due(this.now())) {
      for (let count = 0; count < 8; count++) {
        let progressed = false;
        await this.serial(id, async () => {
          const current = (await this.repository.load(id))?.state;
          if (
            !current ||
            current.deletedAt ||
            current.mode !== 'multiplayer' ||
            current.status !== 'active' ||
            current.nextScheduledAt > this.now()
          )
            return;
          if (current.results.some((r) => (r.startedAt ?? 0) + MATCH_DURATION_MS > this.now()))
            return;
          const played = playNextBatch(current, current.nextScheduledAt);
          if (!played.ok) return;
          await this.commit(
            current,
            played.value,
            current.administratorId,
            'Rodada automática concluída',
          );
          progressed = true;
        });
        if (!progressed) break;
      }
    }
  }

  async search(id: string, userId: string, query: string) {
    await this.expire(id);
    const saved = await this.repository.load(id);
    if (
      !saved ||
      saved.state.deletedAt ||
      !saved.state.participants.some((p) => p.userId === userId)
    )
      throw new Error('Acesso negado');
    const { state } = saved;
    let trie = this.searchIndexes.get(state.players.byId);
    if (!trie) {
      trie = new SearchTrie();
      for (const player of Object.values(state.players.byId)) {
        trie.insert(player.name, player.id);
        for (const token of player.name.split(' ')) trie.insert(token, player.id);
      }
      this.searchIndexes.set(state.players.byId, trie);
    }
    return trie
      .search(query)
      .slice(0, 50)
      .map((playerId) => state.players.byId[playerId]);
  }
  private async serial<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.queues.set(key, current);
    try {
      return await current;
    } finally {
      if (this.queues.get(key) === current) this.queues.delete(key);
    }
  }
}
