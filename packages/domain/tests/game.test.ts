import { beforeAll, describe, expect, it } from 'vitest';
import {
  COMPETITIONS,
  GAMEPLAY,
  roundMoney,
  type GameCommand,
  type WorldState,
} from '@football/shared';
import {
  applyEvent,
  createWorld,
  executeCommand,
  playNextBatch,
  pendingFixtures,
  transferContext,
  upgradePrice,
  stableId,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const NOW = Date.parse('2026-10-26T15:00:00Z');
let initial: WorldState;
let sequence = 10;
function command(state: WorldState, action: GameCommand, actor: string = IDS.user, now = NOW) {
  return executeCommand(state, action, actor, now, stableId(9, sequence++));
}
function act(state: WorldState, action: GameCommand, actor: string = IDS.user) {
  return unwrap(applyEvent(state, unwrap(command(state, action, actor))));
}
beforeAll(() => {
  initial = unwrap(
    createWorld({ id: IDS.league, userId: IDS.user, name: 'Teste', mode: 'offline', now: NOW }),
  );
});

describe('mundo e autoridade', () => {
  it('cria séries A, B, C, regionais e jogadores internacionais fictícios', () => {
    expect(initial.clubs.ids.filter((id) => initial.clubs.byId[id]?.country === 'BR')).toHaveLength(
      85,
    );
    expect(initial.players.ids.length).toBeGreaterThan(1200);
    expect(initial.clubs.ids.filter((id) => initial.clubs.byId[id]?.division === 'A')).toHaveLength(
      20,
    );
    expect(initial.clubs.ids.filter((id) => initial.clubs.byId[id]?.division === 'D')).toHaveLength(
      25,
    );
    expect(
      new Set(
        initial.fixtures.filter((fixture) => fixture.group).map((fixture) => fixture.competitionId),
      ).size,
    ).toBe(3);
    const regional = initial.clubs.ids.filter((id) => initial.clubs.byId[id]?.division === 'D');
    expect(
      initial.fixtures.some((fixture) => !fixture.group && regional.includes(fixture.homeId)),
    ).toBe(true);
    expect(COMPETITIONS).toHaveLength(13);
    expect(COMPETITIONS.some((rule) => rule.id === 'conferencia')).toBe(false);
    expect(initial.fixtures.some((fixture) => fixture.competitionId === 'conferencia')).toBe(false);
    expect(
      createWorld({ id: 'bad', userId: IDS.user, name: 'Test', mode: 'offline', now: NOW }).ok,
    ).toBe(false);
  });
  it('duas ligas com a mesma seed têm resultados idênticos e estado isolado', () => {
    const second = unwrap(
      createWorld({
        id: stableId(1, 999),
        userId: IDS.user,
        name: 'Outra',
        mode: 'offline',
        now: NOW,
      }),
    );
    const firstRound = unwrap(playNextBatch(initial, NOW));
    const secondRound = unwrap(playNextBatch(second, NOW));
    expect(firstRound.results).toEqual(secondRound.results);
    expect(initial.results).toEqual([]);
    expect(firstRound.round).toBe(1);
    expect(firstRound.participants.every((member) => !member.ready)).toBe(true);
    expect(pendingFixtures(firstRound)[0]?.scheduledAt).toBe(firstRound.nextScheduledAt);
  });
  it('não permite comandos de terceiros nem avanço não autorizado', () => {
    expect(command(initial, { type: 'advance' }, IDS.secondUser).ok).toBe(false);
    const state = {
      ...initial,
      mode: 'multiplayer' as const,
      participants: [
        ...initial.participants,
        { userId: IDS.secondUser, clubId: stableId(1, 2), ready: false },
      ],
    };
    expect(command(state, { type: 'advance' }, IDS.secondUser).ok).toBe(false);
    expect(
      command(
        {
          ...state,
          participants: state.participants.map((member) => ({ ...member, ready: true })),
        },
        { type: 'advance' },
        IDS.secondUser,
      ).ok,
    ).toBe(true);
    expect(command({ ...initial, status: 'finished' }, { type: 'advance' }).ok).toBe(false);
  });
  it('administrador avança partidas mesmo fora da janela automática', () => {
    const event = unwrap(
      command(initial, { type: 'advance' }, IDS.user, Date.parse('2026-10-26T04:00:00Z')),
    );
    const next = unwrap(applyEvent(initial, event));
    expect(next.results.length).toBeGreaterThan(initial.results.length);
    expect(event.type).toBe('round.played');
  });
  it('eventos são reproduzíveis, ordenados e recusam replay duplicado', () => {
    const event = unwrap(command(initial, { type: 'ready', ready: true }));
    const next = unwrap(applyEvent(initial, event));
    expect(next.participants[0]?.ready).toBe(true);
    expect(initial.participants[0]?.ready).toBe(false);
    expect(applyEvent(next, event).ok).toBe(false);
    expect(act(next, { type: 'ready', ready: false }).participants[0]?.ready).toBe(false);
  });
  it('rejeita o início prematuro de outra temporada', () => {
    expect(command(initial, { type: 'new-season' }).ok).toBe(false);
  });
});
describe('melhorias e economia', () => {
  it.each([
    'pitch',
    'surroundings',
    'structure',
    'food',
    'shirts',
    'hospitality',
    'fitness',
    'medical',
    'scouting',
    'coaching',
    'marketing',
  ] as const)('melhora %s e desconta exatamente o custo', (target) => {
    const own = initial.participants[0]?.clubId ?? '';
    const before = initial.clubs.byId[own];
    if (!before) throw new Error('Clube ausente');
    const stadium = initial.stadiums.byId[before.stadiumId];
    const center = initial.centers.byId[before.trainingCenterId];
    const level =
      target === 'structure'
        ? Math.max(...(stadium?.sectors.map((s) => s.level) ?? [1]))
        : target === 'pitch'
          ? stadium?.pitchLevel
          : target === 'surroundings'
            ? stadium?.surroundingsLevel
            : target === 'food'
              ? stadium?.commerce.foodLevel
              : target === 'shirts'
                ? stadium?.commerce.shirtsLevel
                : target === 'hospitality'
                  ? stadium?.commerce.hospitalityLevel
                  : center?.levels[target];
    const funded = {
      ...initial,
      clubs: {
        ...initial.clubs,
        byId: {
          ...initial.clubs.byId,
          [own]: { ...before, balance: { ...before.balance, cents: 100000000000 } },
        },
      },
    };
    const next = act(funded, { type: 'upgrade', target });
    expect(next.clubs.byId[own]?.balance.cents).toBe(
      100000000000 - upgradePrice(level ?? 1, target),
    );
    expect(initial.clubs.byId[own]?.balance.cents).toBe(before.balance.cents);
  });
  it('evolui todas as arquibancadas com uma única compra e preserva o gramado', () => {
    const clubId = initial.participants[0]?.clubId ?? '';
    const stadiumId = initial.clubs.byId[clubId]?.stadiumId ?? '';
    const before = initial.stadiums.byId[stadiumId];
    const fundedClub = initial.clubs.byId[clubId]!;
    const funded = {
      ...initial,
      clubs: {
        ...initial.clubs,
        byId: {
          ...initial.clubs.byId,
          [clubId]: { ...fundedClub, balance: { ...fundedClub.balance, cents: 100000000000 } },
        },
      },
    };
    const next = act(funded, { type: 'upgrade', target: 'structure' });
    const after = next.stadiums.byId[stadiumId];
    expect(after?.sectors.map((sector) => sector.level)).toEqual(
      before?.sectors.map((s) => s.level + 1),
    );
    expect(after?.sectors.map((sector) => sector.capacity)).toEqual(
      before?.sectors.map((sector) => sector.capacity + GAMEPLAY.upgradeCapacity),
    );
    expect(after?.pitchLevel).toBe(before?.pitchLevel);
    expect(after?.commerce).toEqual(before?.commerce);
  });
  it('recusa caixa insuficiente e teto de nível', () => {
    const id = initial.participants[0]?.clubId ?? '';
    const club = initial.clubs.byId[id];
    if (!club) throw new Error('Clube ausente');
    const bankrupt = {
      ...initial,
      clubs: {
        ...initial.clubs,
        byId: { ...initial.clubs.byId, [id]: { ...club, balance: { ...club.balance, cents: 0 } } },
      },
    };
    expect(command(bankrupt, { type: 'upgrade', target: 'structure' }).ok).toBe(false);
    let state = {
      ...initial,
      clubs: {
        ...initial.clubs,
        byId: {
          ...initial.clubs.byId,
          [id]: { ...club, balance: { ...club.balance, cents: 100000000000 } },
        },
      },
    };
    for (
      let level = initial.stadiums.byId[club.stadiumId]?.sectors[0]?.level ?? 1;
      level < 5;
      level++
    )
      state = act(state, { type: 'upgrade', target: 'structure' });
    expect(command(state, { type: 'upgrade', target: 'structure' }).ok).toBe(false);
  });
});
describe('transferências em duas etapas', () => {
  function candidate() {
    const player = Object.values(initial.players.byId).find(
      (item) => !item.clubId && item.age >= 30 && item.overall < 80,
    );
    if (!player) throw new Error('Atleta de teste ausente');
    return player;
  }
  it('exige valor e interesse antes de permitir salário, e transfere atomicamente', () => {
    const player = candidate();
    const beforeClub = initial.clubs.byId[initial.participants[0]?.clubId ?? ''];
    if (!beforeClub) throw new Error('Clube ausente');
    expect(
      command(initial, { type: 'salary', negotiationId: stableId(9, 800), salary: 100 }).ok,
    ).toBe(false);
    expect(
      command(initial, {
        type: 'offer',
        playerId: player.id,
        fee: 0,
      }).ok,
    ).toBe(true);
    const offered = act(initial, {
      type: 'offer',
      playerId: player.id,
      fee: player.marketValue.cents,
    });
    const offer = offered.negotiations[0];
    if (!offer) throw new Error('Proposta ausente');
    expect(offered.clubs.byId[beforeClub.id]?.balance.cents).toBe(beforeClub.balance.cents);
    expect(
      command(offered, { type: 'offer', playerId: player.id, fee: player.marketValue.cents }).ok,
    ).toBe(false);
    const refused = act(offered, { type: 'salary', negotiationId: offer.id, salary: 1 });
    expect(refused.negotiations[0]?.salaryFirm).toBe(true);
    expect(refused.players.byId[player.id]?.clubId).toBe(player.clubId);
    const salary = transferContext(offered, player, beforeClub).minimumSalary;
    const signed = act(offered, { type: 'salary', negotiationId: offer.id, salary });
    expect(signed.players.byId[player.id]?.clubId).toBe(beforeClub.id);
    expect(signed.clubs.byId[beforeClub.id]?.playerIds).toContain(player.id);
    expect(signed.clubs.byId[beforeClub.id]?.balance.cents).toBe(
      roundMoney(beforeClub.balance.cents - player.marketValue.cents - salary),
    );
    expect(command(signed, { type: 'salary', negotiationId: offer.id, salary }).ok).toBe(false);
  });
  it('recusa contratações sem caixa e permite conversar mesmo com baixo interesse', () => {
    const player = candidate();
    expect(
      command(initial, { type: 'offer', playerId: player.id, fee: Number.MAX_SAFE_INTEGER }).ok,
    ).toBe(false);
    const ownPlayer =
      initial.players.ids.find(
        (id) => initial.players.byId[id]?.clubId === initial.participants[0]?.clubId,
      ) ?? '';
    expect(command(initial, { type: 'offer', playerId: ownPlayer, fee: 1 }).ok).toBe(false);
    const star = { ...player, overall: 99, potential: 99, age: 17 };
    const state = {
      ...initial,
      players: { ...initial.players, byId: { ...initial.players.byId, [player.id]: star } },
    };
    expect(
      command(state, { type: 'offer', playerId: player.id, fee: player.marketValue.cents }).ok,
    ).toBe(true);
  });
});
