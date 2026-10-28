import { beforeEach, describe, expect, it } from 'vitest';
import { worldStateSchema, roundMoney, type WorldState } from '@football/shared';
import {
  createWorld,
  stableId,
  executeCommand,
  applyEvent,
  settleMonthly,
  maintenanceBreakdown,
  transferContext,
  effectiveOverall,
  generateIncomingOffers,
  tacticalBonus,
  contractEnd,
} from '../src/index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
let state: WorldState;
beforeEach(() => {
  state = unwrap(
    createWorld({ id: stableId(91, 1), name: 'Gestão', mode: 'offline', userId: 'host', now }),
  );
});
const own = () => state.clubs.byId[state.participants[0]!.clubId]!;
function act(command: Parameters<typeof executeCommand>[1]) {
  return unwrap(
    applyEvent(
      state,
      unwrap(executeCommand(state, command, 'host', now, stableId(92, state.revision + 1))),
    ),
  );
}

describe('gestão financeira mensal', () => {
  it('cobra somente ao cruzar dia 1 de Brasília, repete meses saltados e não duplica', () => {
    const club = own(),
      wages = roundMoney(
        club.playerIds.reduce((sum, id) => sum + state.players.byId[id]!.salary.cents, 0),
      ),
      maintenance = maintenanceBreakdown(state, club).reduce((sum, item) => sum + item.cost, 0);
    expect(
      settleMonthly(state, Date.parse('2026-02-01T02:59:59Z')).management?.charges,
    ).toHaveLength(0);
    const settled = settleMonthly(state, Date.parse('2026-03-01T03:00:00Z'));
    expect(settled.management?.charges?.filter((c) => c.clubId === club.id)).toHaveLength(2);
    expect(settled.clubs.byId[club.id]!.balance.cents).toBe(
      roundMoney(Math.max(0, club.balance.cents - 2 * (wages + maintenance))),
    );
    expect(
      settleMonthly(settled, Date.parse('2026-03-01T03:00:00Z')).management?.charges,
    ).toHaveLength(settled.management?.charges?.length ?? 0);
    expect(worldStateSchema.safeParse(settled).success).toBe(true);
  });
  it('aplica atraso sem alterar o overall base e remove a penalidade após pagamento', () => {
    const club = own(),
      player = state.players.byId[club.playerIds[0]!]!;
    state = {
      ...state,
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: { ...club, balance: { ...club.balance, cents: 0 } },
        },
      },
    };
    state = settleMonthly(state, Date.parse('2026-02-01T03:00:00Z'));
    expect(state.players.byId[player.id]!.overall).toBe(player.overall);
    expect(effectiveOverall(state, player)).toBe(Math.max(1, player.overall - 5));
    state = {
      ...state,
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: { ...club, balance: { ...club.balance, cents: 10000000000 } },
        },
      },
    };
    state = act({ type: 'management', action: 'pay-debt' });
    expect(effectiveOverall(state, player)).toBe(player.overall);
  });
  it('vende um nível e reduz manutenção e bônus reais, sem vender o nível básico', () => {
    const club = own(),
      center = state.centers.byId[club.trainingCenterId]!,
      before = center.levels.coaching;
    if (before <= 1)
      state = {
        ...state,
        centers: {
          ...state.centers,
          byId: {
            ...state.centers.byId,
            [center.id]: { ...center, levels: { ...center.levels, coaching: 2 } },
          },
        },
      };
    const upkeep = maintenanceBreakdown(state, club).reduce((s, c) => s + c.cost, 0);
    const next = act({ type: 'management', action: 'sell-facility', target: 'coaching' });
    expect(next.centers.byId[center.id]!.levels.coaching).toBe(Math.max(2, before) - 1);
    expect(maintenanceBreakdown(next, club).reduce((s, c) => s + c.cost, 0)).toBeLessThan(upkeep);
    expect(next.clubs.byId[club.id]!.balance.cents).toBeGreaterThan(club.balance.cents);
  });
});
describe('contratos e negociação', () => {
  it('preserva políticas em eventos e permite renovar apenas com moral e salário adequados', () => {
    const club = own(),
      player = state.players.byId[club.playerIds[0]!]!;
    state = act({
      type: 'management',
      action: 'policy',
      playerId: player.id,
      available: true,
      rivals: false,
      interest: 80,
    });
    expect(state.management?.policies?.[player.id]?.interest).toBe(80);
    const end = contractEnd(state, player);
    state = act({
      type: 'management',
      action: 'renew',
      playerId: player.id,
      salary: 100000000,
      years: 2,
    });
    expect(contractEnd(state, player)).toBeGreaterThan(end);
    const low = {
      ...state,
      players: {
        ...state.players,
        byId: { ...state.players.byId, [player.id]: { ...player, morale: 1 } },
      },
    };
    expect(
      executeCommand(
        low,
        { type: 'management', action: 'renew', playerId: player.id, salary: 100000000 },
        'host',
        now,
        stableId(93, 1),
      ).ok,
    ).toBe(false);
  });
  it('bloqueia jogadores humanos indisponíveis e torna preço e salário sensíveis aos interesses', () => {
    const seller = own(),
      player = state.players.byId[seller.playerIds[0]!]!,
      buyer = Object.values(state.clubs.byId).find((c) => c.id !== seller.id)!;
    expect(transferContext(state, player, buyer).blocked).toBe(true);
    state = act({
      type: 'management',
      action: 'policy',
      playerId: player.id,
      available: true,
      rivals: true,
      interest: 100,
    });
    const willing = transferContext(state, player, buyer);
    state = act({
      type: 'management',
      action: 'policy',
      playerId: player.id,
      available: true,
      rivals: true,
      interest: 1,
    });
    const unwilling = transferContext(state, player, buyer);
    expect(willing.minimumFee).toBeLessThan(unwilling.minimumFee);
    expect(willing.playerInterest).toBeGreaterThanOrEqual(1);
    expect(transferContext(state, { ...player, clubId: null }, buyer).minimumFee).toBe(0);
  });
  it('gera proposta conforme necessidade, reserva financeira e transfere atomicamente', () => {
    const seller = own(),
      player = state.players.byId[seller.playerIds[0]!]!,
      buyer = Object.values(state.clubs.byId).find((c) => c.id !== seller.id)!;
    state = act({
      type: 'management',
      action: 'policy',
      playerId: player.id,
      available: true,
      rivals: true,
      interest: 100,
    });
    state = {
      ...state,
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [buyer.id]: {
            ...buyer,
            playerIds: [],
            balance: { ...buyer.balance, cents: 100000000000 },
          },
        },
      },
    };
    state = generateIncomingOffers(state);
    const offer = state.management?.offers?.find((o) => o.playerId === player.id);
    if (!offer) throw new Error('Proposta esperada ausente');
    expect(offer).toBeTruthy();
    state = act({ type: 'management', action: 'accept', offerId: offer.id });
    expect(state.players.byId[player.id]!.clubId).toBe(offer.buyerId);
    expect(state.clubs.byId[seller.id]!.playerIds).not.toContain(player.id);
    expect(
      state.clubs.byId[offer.buyerId]!.playerIds.filter((id) => id === player.id),
    ).toHaveLength(1);
    expect(worldStateSchema.safeParse(state).success).toBe(true);
  });
});
it('limita a vantagem tática e exige qualidade nos jogadores chave', () => {
  const player = state.players.byId[own().playerIds[0]!]!;
  const strong = { ...player, position: 'LW' as const, overall: 90, fitness: 100 };
  const weak = { ...strong, overall: 45 };
  expect(tacticalBonus('wings', '4-3-3', 'low-block', '5-3-2', [strong])).toBeGreaterThan(
    tacticalBonus('wings', '4-3-3', 'low-block', '5-3-2', [weak]),
  );
  expect(
    Math.abs(tacticalBonus('wings', '4-3-3', 'low-block', '4-3-1-2', [strong])),
  ).toBeLessThanOrEqual(3);
});

describe('contratação direta de jogadores livres', () => {
  it('assina em uma etapa, sem taxa de transferência nem negociação pendente', () => {
    const club = own(),
      player = Object.values(state.players.byId).find((p) => p.clubId === null)!;
    const salary = transferContext(state, player, club).minimumSalary;
    const previousBalance = club.balance.cents;
    state = act({ type: 'sign-free', playerId: player.id, salary });
    expect(state.players.byId[player.id]!.clubId).toBe(club.id);
    expect(state.players.byId[player.id]!.salary.cents).toBe(salary);
    expect(state.clubs.byId[club.id]!.balance.cents).toBe(roundMoney(previousBalance - salary));
    expect(state.negotiations).toHaveLength(1);
    expect(state.negotiations[0]).toMatchObject({
      fee: 0,
      status: 'completed',
      offeredSalary: salary,
    });
    expect(worldStateSchema.safeParse(state).success).toBe(true);
  });
  it('persiste a contraproposta salarial e permite contratação sem caixa', () => {
    const club = own(),
      player = Object.values(state.players.byId).find((p) => p.clubId === null)!;
    const salary = transferContext(state, player, club).minimumSalary;
    const rejected = executeCommand(
      state,
      { type: 'sign-free', playerId: player.id, salary: 0 },
      'host',
      now,
      stableId(94, 1),
    );
    expect(rejected.ok).toBe(true);
    const countered = unwrap(applyEvent(state, unwrap(rejected)));
    expect(countered.negotiations.at(-1)?.salaryFirm).toBe(true);
    expect(countered.players.byId[player.id]?.clubId).toBeNull();
    const poor = {
      ...state,
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: { ...club, balance: { ...club.balance, cents: 0 } },
        },
      },
    };
    expect(
      executeCommand(
        poor,
        { type: 'sign-free', playerId: player.id, salary },
        'host',
        now,
        stableId(94, 2),
      ).ok,
    ).toBe(true);
    expect(state.negotiations).toHaveLength(0);
    expect(state.players.byId[player.id]!.clubId).toBeNull();
    expect(
      executeCommand(
        state,
        { type: 'sign-free', playerId: club.playerIds[0]!, salary },
        'host',
        now,
        stableId(94, 3),
      ).ok,
    ).toBe(false);
  });
});

describe('Scout da base', () => {
  it('negocia apenas salário, repõe três vagas e esgota a lista na temporada', () => {
    const clubId = own().id;
    state = act({ type: 'management', action: 'scout-academy' });
    const prospects = () =>
      Object.values(state.players.byId).filter(
        (p) => p.academyClubId === clubId && !p.clubId && p.academySeason === state.season,
      );
    expect(prospects()).toHaveLength(5);
    const originalCount = own().playerIds.length;
    for (let i = 0; i < 8; i++) {
      const player = prospects()[0]!;
      state = act({ type: 'management', action: 'promote-academy', playerId: player.id });
      expect(own().playerIds.length).toBe(originalCount + i);
      const negotiation = state.negotiations.find(
        (n) => n.playerId === player.id && n.status === 'salary',
      )!;
      expect(negotiation.fee).toBe(0);
      state = act({
        type: 'salary',
        negotiationId: negotiation.id,
        salary: negotiation.minimumSalary!,
      });
      expect(state.players.byId[player.id]?.clubId).toBe(clubId);
      expect(prospects()).toHaveLength(Math.max(0, 5 - Math.max(0, i + 1 - 3)));
    }
    state = act({ type: 'management', action: 'scout-academy' });
    expect(prospects()).toHaveLength(0);
    state = { ...state, season: state.season + 1 };
    state = act({ type: 'management', action: 'scout-academy' });
    expect(prospects()).toHaveLength(5);
  });
});

it('dispensas compartilham as três reposições e encerram a negociação salarial', () => {
  const clubId = own().id;
  state = act({ type: 'management', action: 'scout-academy' });
  const list = () =>
    Object.values(state.players.byId).filter(
      (p) =>
        p.academyClubId === clubId &&
        !p.clubId &&
        p.academySeason === state.season &&
        p.academyDismissedSeason === undefined,
    );
  for (let i = 0; i < 4; i++) {
    const player = list()[0]!;
    state = act({ type: 'management', action: 'promote-academy', playerId: player.id });
    state = act({ type: 'management', action: 'dismiss-academy', playerId: player.id });
    expect(list()).toHaveLength(i < 3 ? 5 : 4);
    expect(list().some((p) => p.id === player.id)).toBe(false);
    expect(state.negotiations.find((n) => n.playerId === player.id)?.status).toBe('rejected');
  }
  state = act({ type: 'management', action: 'scout-academy' });
  expect(list()).toHaveLength(4);
});
