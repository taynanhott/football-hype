import { z } from 'zod';
import { randomUUID, randomInt } from 'node:crypto';
import {
  applyEvent,
  normalizeRoundCalendar,
  upgradeUnstartedCompetitions,
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
  advanceGameDays,
  realTimeGameDate,
  pendingFixtures,
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
  private readonly onlineSessions = new Map<string, Set<string>>();
  setOnline(leagueId: string, userId: string, sessionId: string, online: boolean) {
    const key = `${leagueId}:${userId}`;
    const sessions = this.onlineSessions.get(key) ?? new Set<string>();
    if (online) sessions.add(sessionId);
    else sessions.delete(sessionId);
    if (sessions.size) this.onlineSessions.set(key, sessions);
    else this.onlineSessions.delete(key);
    this.updates.emit(leagueId);
  }
  private readonly searchIndexes = new WeakMap<object, SearchTrie>();
  readonly updates = new EventBus<string>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private ticking: Promise<void> | undefined;
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
  async draw(identity: Identity, input: unknown) {
    const { mode, division } = z
      .object({ mode: z.enum(['offline', 'multiplayer']), division: z.enum(['A', 'B', 'C', 'D']) })
      .parse(input);
    if (!this.repository.reserveDraw) throw new Error('Sorteio indisponível neste servidor');
    const clubs = (await this.catalog()).clubs.filter((club) => club.division === division);
    if (!clubs.length) throw new Error('Esta divisão não possui clubes');
    return this.repository.reserveDraw(identity.userId, mode, {
      leagueId: randomUUID(),
      clubId: clubs[randomInt(clubs.length)]!.id,
      division,
    });
  }
  async create(identity: Identity, input: unknown): Promise<string> {
    return this.serial(`membership:${identity.userId}`, async () => {
      const options = connectOptionsSchema.parse(input);
      const draw = await this.repository.getDraw?.(identity.userId, options.mode);
      if (draw) {
        options.clubId = draw.clubId;
        options.assignment = 'chosen';
      }
      const memberships = this.repository.summariesForUser
        ? await this.repository.summariesForUser(identity.userId)
        : await this.repository.forUser(identity.userId);
      const current = memberships.filter((league) => league.mode === options.mode);
      if (current.length >= (options.mode === 'offline' ? 2 : 1))
        throw new Error('Limite de 2 carreiras solo e 1 liga multiplayer atingido neste modo');
      const generated = createWorld({
        id: draw?.leagueId ?? randomUUID(),
        userId: identity.userId,
        name: options.name,
        mode: options.mode,
        now: this.now(),
        seed: randomInt(1, 2147483647),
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
        inviteCode: options.mode === 'multiplayer' ? randomUUID() : undefined,
        seasonClock: 1,
        calendarAnchor: { realAt: this.now(), gameAt: state.lastProcessedAt },
        nextScheduledAt: nextRealMatchTime(this.now()),
        participants: state.participants.map((member) => ({ ...member, lastSeenAt: this.now() })),
      };
      state = normalizeRoundCalendar(state);
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
      club: state.clubs.byId[
        state.participants.find((member) => member.userId === userId)?.clubId ?? ''
      ],
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
  private async ensureSeasonClock(id: string) {
    await this.serial(id, async () => {
      const saved = await this.repository.load(id, { eventPatches: false });
      if (
        !saved ||
        saved.state.deletedAt ||
        (saved.state.seasonClock && saved.state.calendarAnchor) ||
        saved.state.status !== 'active'
      )
        return;
      await this.commit(
        saved.state,
        {
          ...saved.state,
          seasonClock: 1,
          calendarAnchor: { realAt: this.now(), gameAt: saved.state.lastProcessedAt },
          nextScheduledAt: saved.state.seasonClock
            ? saved.state.nextScheduledAt
            : nextRealMatchTime(this.now()),
        },
        saved.state.administratorId,
        'Relógio online ativado para a carreira',
      );
    });
  }
  private async expire(id: string) {
    return this.serial(id, async () => {
      const saved = await this.repository.load(id, { eventPatches: false });
      if (!saved || saved.state.deletedAt || saved.state.mode !== 'multiplayer') return saved;
      const state = saved.state;
      const participants = state.participants.map((p) =>
        p.lastSeenAt === undefined ? { ...p, lastSeenAt: this.now() } : p,
      );
      if (!state.inviteCode || state.participants.some((p) => p.lastSeenAt === undefined)) {
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
        return this.repository.load(id, { eventPatches: false });
      }
      return saved;
    });
  }
  async touch(id: string, userId: string) {
    await this.expire(id);
    await this.serial(id, async () => {
      const saved = await this.repository.load(id, { eventPatches: false });
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
  async invitation(id: string, input: unknown, userId?: string) {
    const { code } = z.object({ code: z.string() }).parse(input);
    await this.expire(id);
    const state = (await this.repository.load(id, { eventPatches: false }))?.state;
    if (!state || state.deletedAt || state.mode !== 'multiplayer' || state.inviteCode !== code)
      throw new Error('Convite inválido');
    return {
      admission: state.returningClubs?.[userId ?? '']
        ? { ...state.admission, assignment: 'chosen' as const }
        : state.admission,
      clubs: state.clubs.ids.flatMap((id) => {
        const reserved = state.returningClubs?.[userId ?? ''];
        const club = state.clubs.byId[id];
        if (
          !club ||
          club.country !== 'BR' ||
          (reserved && reserved !== id) ||
          (!reserved && state.admission.division && club.division !== state.admission.division)
        )
          return [];
        const occupied =
          state.participants.some((member) => member.clubId === id) ||
          Object.entries(state.returningClubs ?? {}).some(
            ([owner, clubId]) => clubId === id && owner !== userId,
          );
        return [
          {
            id: club.id,
            name: club.name,
            division: club.division,
            occupied,
            ...(club.crestUrl ? { crestUrl: club.crestUrl } : {}),
          },
        ];
      }),
    };
  }
  async requestEntry(id: string, identity: Identity, input: unknown) {
    const data = z.object({ code: z.string(), clubId: z.uuid().optional() }).parse(input);
    await this.expire(id);
    return this.serial(id, async () => {
      const state = (await this.repository.load(id, { eventPatches: false }))?.state;
      if (
        !state ||
        state.deletedAt ||
        state.mode !== 'multiplayer' ||
        data.code !== state.inviteCode
      )
        throw new Error('Convite inválido');
      if (state.participants.some((p) => p.userId === identity.userId)) return;
      const returningClub = state.returningClubs?.[identity.userId];
      if (returningClub) {
        this.availableClub(state, returningClub, identity.userId);
        const returningClubs = { ...state.returningClubs };
        delete returningClubs[identity.userId];
        await this.commit(
          state,
          {
            ...state,
            returningClubs,
            participants: [
              ...state.participants,
              {
                userId: identity.userId,
                clubId: returningClub,
                ready: false,
                lastSeenAt: this.now(),
              },
            ],
            requests: state.requests.filter((request) => request.userId !== identity.userId),
          },
          identity.userId,
          'Treinador retornou ao clube anterior',
        );
        return { rejoined: true };
      }
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
  private availableClub(state: import('@football/shared').WorldState, id: string, userId?: string) {
    const club = state.clubs.byId[id];
    if (
      !club ||
      club.country !== 'BR' ||
      (state.admission.division && club.division !== state.admission.division) ||
      state.participants.some((p) => p.clubId === id) ||
      Object.entries(state.returningClubs ?? {}).some(
        ([owner, clubId]) => clubId === id && owner !== userId,
      )
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
        const state = (await this.repository.load(id, { eventPatches: false }))?.state;
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
  async kick(id: string, userId: string, input: unknown) {
    const target = z.object({ userId: z.string() }).parse(input).userId;
    return this.serial(id, async () => {
      const state = (await this.repository.load(id, { eventPatches: false }))?.state;
      if (
        !state ||
        state.deletedAt ||
        state.mode !== 'multiplayer' ||
        state.administratorId !== userId ||
        target === userId
      )
        throw new Error('Acesso negado');
      const returningClubs = { ...state.returningClubs };
      delete returningClubs[target];
      await this.commit(
        state,
        {
          ...state,
          returningClubs,
          participants: state.participants.filter((member) => member.userId !== target),
          requests: state.requests.filter((request) => request.userId !== target),
        },
        userId,
        'Treinador expulso; vínculo com o clube liberado',
      );
    });
  }
  async reset(id: string, userId: string) {
    return this.serial(id, async () => {
      const saved = await this.repository.load(id, { eventPatches: false });
      if (!saved || saved.state.deletedAt || saved.state.administratorId !== userId)
        throw new Error('Somente o administrador pode resetar a carreira');
      const previous = saved.state;
      const generated = createWorld({
        id,
        userId,
        name: previous.name,
        mode: previous.mode,
        now: this.now(),
      });
      if (!generated.ok) throw new Error(generated.error.message);
      let fresh = generated.value;
      if (this.dataProvider) {
        const dataset = this.dataProvider.loadForLeague
          ? await this.dataProvider.loadForLeague(id)
          : await this.dataProvider.load();
        if (!dataset.ok) throw new Error(dataset.error.message);
        const imported = importDataset(fresh, dataset.value);
        if (!imported.ok) throw new Error(imported.error.message);
        fresh = imported.value;
      }
      if (previous.participants.some((member) => !fresh.clubs.byId[member.clubId]))
        throw new Error('Um clube desta carreira não está mais disponível na base');
      await this.commit(
        previous,
        {
          ...fresh,
          participants: previous.participants.map((member) => ({
            userId: member.userId,
            clubId: member.clubId,
            ready: false,
          })),
          inviteCode: previous.inviteCode,
          calendarAnchor: { realAt: this.now(), gameAt: fresh.lastProcessedAt },
          nextScheduledAt: nextRealMatchTime(this.now()),
        },
        userId,
        'Carreira reiniciada do zero',
      );
    });
  }
  async leave(id: string, userId: string, remove = false) {
    await this.serial(id, async () => {
      const loaded = (await this.repository.load(id, { eventPatches: false }))?.state;
      if (remove && loaded?.mode === 'multiplayer') remove = false;
      if (remove && this.repository.remove) {
        await this.repository.remove(id, userId, this.now());
        this.updates.emit(id);
        return;
      }
      const state = (await this.repository.load(id, { eventPatches: false }))?.state;
      if (!state || state.deletedAt || !state.participants.some((p) => p.userId === userId))
        throw new Error('Acesso negado');
      if (remove && state.administratorId !== userId)
        throw new Error('Somente o administrador pode excluir');
      if (!remove && state.mode === 'offline')
        throw new Error('Use excluir para uma carreira solo');
      const participants = remove ? [] : state.participants.filter((p) => p.userId !== userId);
      const empty = state.mode === 'multiplayer' && participants.length === 0;
      await this.commit(
        state,
        {
          ...state,
          participants,
          ...(state.mode === 'multiplayer'
            ? {
                returningClubs: {
                  ...state.returningClubs,
                  [userId]: state.participants.find((member) => member.userId === userId)!.clubId,
                },
              }
            : {}),
          requests: remove || empty ? [] : state.requests,
          administratorId: participants.some((p) => p.userId === state.administratorId)
            ? state.administratorId
            : participants.length
              ? participants[randomInt(participants.length)]!.userId
              : state.administratorId,
          ...(remove || empty ? { deletedAt: this.now() } : {}),
        },
        userId,
        remove || empty ? 'Liga excluída' : 'Treinador abandonou a liga; bot assumiu o clube',
      );
    });
  }
  async snapshot(id: string, userId: string, roomId = ''): Promise<GameSnapshot> {
    let saved = await this.expire(id);
    if (
      !saved ||
      saved.state.deletedAt ||
      !saved.state.participants.some((member) => member.userId === userId)
    )
      throw new Error('Acesso negado');
    if (
      (!saved.state.seasonClock || !saved.state.calendarAnchor) &&
      saved.state.status === 'active'
    ) {
      await this.ensureSeasonClock(id);
      saved = (await this.repository.load(id, { eventPatches: false })) ?? saved;
    }
    if (
      saved.state.round === 0 &&
      saved.state.results.length === 0 &&
      !saved.state.seasonArchives?.length &&
      Object.values(saved.state.chemistry).every((players) => Object.keys(players).length === 0)
    ) {
      await this.serial(id, async () => {
        const current = await this.repository.load(id, { eventPatches: false });
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
      saved = (await this.repository.load(id, { eventPatches: false })) ?? saved;
    }
    if (
      saved.state.round === 0 &&
      !saved.state.results.length &&
      saved.state.competitionRulesVersion !== SEASON_CALENDAR_VERSION
    ) {
      await this.serial(id, async () => {
        const current = await this.repository.load(id, { eventPatches: false });
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
      saved = (await this.repository.load(id, { eventPatches: false })) ?? saved;
    }
    if (normalizeRoundCalendar(upgradeUnstartedCompetitions(saved.state)) !== saved.state) {
      await this.serial(id, async () => {
        const current = await this.repository.load(id, { eventPatches: false });
        if (!current) return;
        const next = normalizeRoundCalendar(upgradeUnstartedCompetitions(current.state));
        if (next !== current.state)
          await this.commit(
            current.state,
            next,
            userId,
            'Rodadas reorganizadas com datas exclusivas e descanso',
          );
      });
      saved = (await this.repository.load(id, { eventPatches: false })) ?? saved;
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
      state: {
        ...state,
        participants: state.participants.map((member) => ({
          ...member,
          online: (this.onlineSessions.get(`${id}:${member.userId}`)?.size ?? 0) > 0,
        })),
      },
      serverTime: this.now(),
      tables,
      roomId,
      ledger: saved.events
        .slice(
          saved.events.reduce(
            (last, event, index) =>
              event.message === 'Carreira reiniciada do zero' ? index : last,
            -1,
          ) + 1,
        )
        .slice(-100)
        .map((event) => ({
          id: event.id,
          sequence: event.sequence,
          occurredAt: event.occurredAt,
          ...(event.gameOccurredAt !== undefined ? { gameOccurredAt: event.gameOccurredAt } : {}),
          actorId: event.actorId,
          type: event.type,
          message: event.message,
          amount: event.amount,
          ...(event.balances ? { balances: event.balances } : {}),
        })),
    };
  }
  async command(
    id: string,
    userId: string,
    input: unknown,
    scheduled = false,
    requestId?: string,
  ): Promise<number> {
    if (!scheduled) await this.expire(id);
    return this.serial(id, async () => {
      const saved = await this.repository.load(id, { eventPatches: false });
      if (!saved || saved.state.deletedAt) throw new Error('Liga não encontrada');
      if (requestId) {
        const repeated = saved.events.find((event) => event.id === requestId);
        if (repeated) {
          if (repeated.actorId !== userId) throw new Error('Identificação de ação inválida');
          return saved.state.revision;
        }
      }
      if (
        scheduled &&
        (saved.state.status !== 'active' || saved.state.nextScheduledAt > this.now())
      )
        return saved.state.revision;
      const command = commandSchema.parse(input);
      if (
        (command.type === 'advance' || command.type === 'ready') &&
        saved.state.mode === 'multiplayer' &&
        saved.state.results.some(
          (result) =>
            (result.startedAt ?? 0) + MATCH_DURATION_MS > this.now() &&
            saved.state.participants.some(
              (participant) =>
                participant.clubId === result.homeId || participant.clubId === result.awayId,
            ),
        )
      )
        throw new Error('Aguarde o encerramento dos 90 segundos da rodada');
      const event = executeCommand(
        saved.state,
        command,
        userId,
        this.now(),
        requestId ?? randomUUID(),
      );
      if (!event.ok) throw new Error(event.error.message);
      // Persist presence together with the command instead of writing the world twice.
      if (!scheduled) {
        event.value.patch.participants = (
          event.value.patch.participants ?? saved.state.participants
        ).map((member) =>
          member.userId === userId ? { ...member, lastSeenAt: this.now() } : member,
        );
      }
      const applied = applyEvent(saved.state, event.value);
      if (!applied.ok) throw new Error(applied.error.message);
      await this.repository.append(id, saved.state.revision, applied.value, event.value);
      let revision = applied.value.revision;
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
            revision = state.value.revision;
          }
        }
      }
      return revision;
    });
  }
  tick(): Promise<void> {
    if (!this.ticking)
      this.ticking = this.runTick().finally(() => {
        this.ticking = undefined;
      });
    return this.ticking;
  }
  private async advanceCalendar(id: string) {
    await this.serial(id, async () => {
      const current = (await this.repository.load(id, { eventPatches: false }))?.state;
      if (
        !current ||
        current.deletedAt ||
        current.status !== 'active' ||
        current.nextScheduledAt <= this.now()
      )
        return;
      const nextGame = pendingFixtures(current)[0]?.scheduledAt;
      if (nextGame === undefined) return;
      const next = advanceGameDays(current, realTimeGameDate(current, nextGame, this.now()));
      if (next === current) return;
      await this.commit(
        current,
        next,
        current.administratorId,
        'Calendário avançado: treinos e recuperação processados',
      );
    });
  }
  private async runTick(): Promise<void> {
    for (const id of await this.repository.active()) {
      await this.expire(id);
      await this.ensureSeasonClock(id);
      await this.advanceCalendar(id);
    }
    for (const id of await this.repository.due(this.now())) {
      for (let count = 0; count < 8; count++) {
        let progressed = false;
        await this.serial(id, async () => {
          const current = (await this.repository.load(id, { eventPatches: false }))?.state;
          if (
            !current ||
            current.deletedAt ||
            current.status !== 'active' ||
            current.nextScheduledAt > this.now()
          )
            return;
          if (
            current.results.some(
              (result) =>
                (result.startedAt ?? 0) + MATCH_DURATION_MS > this.now() &&
                current.participants.some(
                  (participant) =>
                    participant.clubId === result.homeId || participant.clubId === result.awayId,
                ),
            )
          )
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
    const saved = await this.expire(id);
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
