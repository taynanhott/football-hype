import { beforeEach, describe, expect, it } from 'vitest';
import type { WorldState, TrainingCenterSnapshot } from '@football/shared';
import {
  createWorld,
  executeCommand,
  stableId,
  temporaryModifiers,
  transferContext,
  loanWage,
  financialLimits,
  applyEvent,
  facilityLevels,
} from '../src/index.js';
import { unwrap, withTransferReserves } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
let state: WorldState;
beforeEach(() => {
  state = withTransferReserves(
    unwrap(
      createWorld({
        id: stableId(985, 1),
        name: 'Proteções',
        userId: 'host',
        mode: 'offline',
        now,
      }),
    ),
  );
});
const club = () => state.clubs.byId[state.participants[0]!.clubId]!;
const run = (command: Parameters<typeof executeCommand>[1]) =>
  executeCommand(state, command, 'host', now, stableId(985, 2));
const setCenter = (change: Partial<TrainingCenterSnapshot>) => {
  const center = state.centers.byId[club().trainingCenterId]!;
  state.centers = {
    ...state.centers,
    byId: { ...state.centers.byId, [center.id]: { ...center, ...change } },
  };
};
const operations = () => ({
  load: 'moderate' as const,
  fitness: [] as string[],
  medical: [] as string[],
  individual: [] as { playerId: string; startedAt: number; endsAt: number }[],
  syringe: false,
});

describe('proteções de gestão em estados concorrentes e legados', () => {
  it.each(['accept-transfer', 'reject-transfer'] as const)(
    'aplica a decisão humana %s apenas à proposta selecionada',
    (action) => {
      const own = club(),
        playerId = own.playerIds[0]!;
      const offer = {
        id: stableId(988, 1),
        sellerId: own.id,
        buyerId: state.clubs.ids.find((id) => id !== own.id)!,
        playerId,
        fee: 1000000,
        offeredSalary: null,
        interest: 80,
        status: 'review' as const,
        expiresAt: state.lastProcessedAt + 86400000,
      };
      state.negotiations = [offer, { ...offer, id: stableId(988, 2) }];
      const next = unwrap(
        applyEvent(state, unwrap(run({ type: 'management', action, offerId: offer.id }))),
      );
      expect(next.negotiations[0]!.status).toBe(
        action === 'accept-transfer' ? 'salary' : 'rejected',
      );
      expect(next.negotiations[1]!.status).toBe('review');
      state.negotiations = [{ ...offer, expiresAt: state.lastProcessedAt }];
      expect(run({ type: 'management', action, offerId: offer.id }).ok).toBe(false);
      state.negotiations = [{ ...offer, playerId: state.clubs.byId[offer.buyerId]!.playerIds[0]! }];
      expect(run({ type: 'management', action, offerId: offer.id }).ok).toBe(false);
    },
  );
  it('valida empréstimo humano antes de reservar salário e impede proposta duplicada', () => {
    const own = club(),
      seller = state.clubs.byId[state.clubs.ids.find((id) => id !== own.id)!]!,
      playerId = seller.playerIds.at(-1)!;
    state.participants = [
      ...state.participants,
      { ...state.participants[0]!, userId: 'seller', clubId: seller.id },
    ];
    const player = state.players.byId[playerId]!;
    state.players = {
      ...state.players,
      byId: {
        ...state.players.byId,
        [playerId]: { ...player, age: 28, overall: 40, potential: 42 },
      },
    };
    state.management = {
      ...state.management,
      contracts: { [playerId]: state.lastProcessedAt + 3 * 365 * 86400000 },
      policies: {
        [playerId]: {
          available: false,
          loanAvailable: true,
          loanMonths: 6,
          rivals: true,
          interest: 75,
        },
      },
    };
    expect(
      run({ type: 'management', action: 'offer-loan', playerId, months: 12, salaryPercent: 100 })
        .ok,
    ).toBe(false);
    state = unwrap(
      applyEvent(
        state,
        unwrap(
          run({
            type: 'management',
            action: 'offer-loan',
            playerId,
            months: 6,
            salaryPercent: 100,
          }),
        ),
      ),
    );
    expect(state.management?.offers).toHaveLength(1);
    expect(state.management?.offers?.[0]!.status).toBe('pending');
    expect(
      run({ type: 'management', action: 'offer-loan', playerId, months: 6, salaryPercent: 100 }).ok,
    ).toBe(false);
    expect(
      run({
        type: 'management',
        action: 'offer-loan',
        playerId: own.playerIds[0]!,
        months: 6,
        salaryPercent: 100,
      }).ok,
    ).toBe(false);
    expect(
      run({
        type: 'management',
        action: 'offer-loan',
        playerId: stableId(988, 99),
        months: 6,
        salaryPercent: 100,
      }).ok,
    ).toBe(false);
  });
  it('tolera referências incompletas na consulta do histórico sem inventar benefícios', () => {
    const own = club(),
      player = state.players.byId[own.playerIds[0]!]!;
    expect(facilityLevels({ ...state, stadiums: { ...state.stadiums, byId: {} } }, own)).toEqual(
      {},
    );
    const orphaned = { ...state, clubs: { ...state.clubs, byId: {} } };
    expect(temporaryModifiers(orphaned, player)).toEqual([]);
    expect(loanWage(state, player.id, 'unrelated')).toBe(0);
  });
  it.each(['fitness', 'medical', 'coaching'] as const)(
    'não remove vagas ocupadas do setor %s',
    (target) => {
      const center = state.centers.byId[club().trainingCenterId]!;
      const playerId = club().playerIds[0]!;
      setCenter({
        levels: { ...center.levels, [target]: 2 },
        operations: {
          ...operations(),
          ...(target === 'coaching'
            ? {
                individual: [
                  { playerId, startedAt: now, endsAt: now + 86400000 },
                  { playerId: club().playerIds[1]!, startedAt: now, endsAt: now + 86400000 },
                ],
              }
            : { [target]: [playerId] }),
        },
      });
      const result = run({ type: 'management', action: 'sell-facility', target });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('atendimentos');
    },
  );
  it.each(['syringe', 'clearance'] as const)(
    'preserva a autorização médica pendente: %s',
    (flag) => {
      const center = state.centers.byId[club().trainingCenterId]!;
      setCenter({
        levels: { ...center.levels, medical: 5 },
        operations: {
          ...operations(),
          ...(flag === 'syringe'
            ? { syringe: true }
            : { clearance: { playerId: club().playerIds[0]!, fixtureId: state.fixtures[0]!.id } }),
        },
      });
      expect(run({ type: 'management', action: 'sell-facility', target: 'medical' }).ok).toBe(
        false,
      );
    },
  );
  it('não vende setor inexistente ou nível básico', () => {
    expect(run({ type: 'management', action: 'sell-facility', target: 'missing' }).ok).toBe(false);
    const center = state.centers.byId[club().trainingCenterId]!;
    setCenter({ levels: { ...center.levels, fitness: 1 } });
    expect(run({ type: 'management', action: 'sell-facility', target: 'fitness' }).ok).toBe(false);
  });
  it('não renova ou rescinde contrato de atleta com vínculo de empréstimo ativo', () => {
    const own = club(),
      playerId = own.playerIds[0]!;
    state.management = {
      ...state.management,
      contracts: { [playerId]: state.lastProcessedAt + 100 * 86400000 },
      loans: {
        [playerId]: {
          ownerId: state.clubs.ids.find((id) => id !== own.id)!,
          borrowerId: own.id,
          endsAt: now + 86400000,
          salaryPercent: 75,
        },
      },
    };
    expect(run({ type: 'management', action: 'terminate-contract', playerId }).ok).toBe(false);
    expect(
      run({ type: 'management', action: 'renew', playerId, years: 1, salary: 1000000 }).ok,
    ).toBe(false);
    expect(loanWage(state, playerId, 'unrelated')).toBe(0);
    expect(loanWage(state, 'missing', own.id)).toBe(0);
  });
  it('recusa redução de prazo e renovação além da idade permitida', () => {
    const playerId = club().playerIds[0]!,
      player = state.players.byId[playerId]!;
    state.players = {
      ...state.players,
      byId: { ...state.players.byId, [playerId]: { ...player, age: 36, morale: 100 } },
    };
    state.management = {
      ...state.management,
      contracts: { [playerId]: state.lastProcessedAt + 700 * 86400000 },
    };
    expect(
      run({ type: 'management', action: 'renew', playerId, years: 1, salary: 1000000 }).ok,
    ).toBe(false);
    expect(
      run({ type: 'management', action: 'renew', playerId, years: 5, salary: 1000000 }).ok,
    ).toBe(false);
  });
  it('exibe separadamente o bônus conquistado e a sobrecarga sem alterar o overall base', () => {
    const player = state.players.byId[club().playerIds[0]!]!;
    setCenter({
      operations: {
        ...operations(),
        progression: { [player.id]: { buff: 3, buffProgress: 0, declineProgress: 0 } },
        effort: { [player.id]: 12 },
      },
    });
    const effects = temporaryModifiers(state, player);
    expect(effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Bônus de treinamento', value: 3 }),
        expect.objectContaining({ label: 'Sobrecarga de treinos', value: -5 }),
      ]),
    );
    expect(state.players.byId[player.id]!.overall).toBe(player.overall);
    expect(temporaryModifiers(state, { ...player, clubId: null })).toEqual([]);
  });
  it('mantém interesse limitado com rivalidade, dívidas e referências ausentes de legado', () => {
    const own = club(),
      seller = state.clubs.byId[state.clubs.ids.find((id) => id !== own.id)!]!,
      player = state.players.byId[seller.playerIds[0]!]!;
    const buyer = {
      ...own,
      abbreviation: 'FLA',
      leagueStrength: undefined,
      playerIds: [...own.playerIds, 'missing'],
    };
    state.clubs = {
      ...state.clubs,
      byId: {
        ...state.clubs.byId,
        [seller.id]: {
          ...seller,
          abbreviation: 'FLU',
          leagueStrength: undefined,
          playerIds: [...seller.playerIds, 'missing'],
        },
      },
    };
    state.debts = { ...state.debts, [own.id]: 1000000, [seller.id]: 1000000 };
    state.centers = { ...state.centers, byId: {} };
    const report = transferContext(state, player, buyer);
    expect(report.playerInterest).toBeGreaterThanOrEqual(1);
    expect(report.playerInterest).toBeLessThanOrEqual(100);
    expect(
      transferContext(state, { ...player, clubId: null }, buyer).playerInterest,
    ).toBeGreaterThanOrEqual(1);
    expect(
      transferContext(state, { ...player, clubId: 'missing' }, buyer).playerInterest,
    ).toBeGreaterThanOrEqual(1);
  });
  it('não reserva ofertas expiradas, encerradas ou destinadas a outro comprador', () => {
    const own = club(),
      playerId = own.playerIds[0]!,
      sellerId = state.clubs.ids.find((id) => id !== own.id)!;
    const clock = state.lastProcessedAt;
    const offer = {
      id: stableId(986, 1),
      buyerId: own.id,
      sellerId,
      playerId,
      fee: 100000,
      salary: 5000,
      status: 'pending' as const,
      offeredAt: clock,
    };
    state.management = {
      ...state.management,
      offers: [
        offer,
        { ...offer, id: stableId(986, 2), status: 'rejected' },
        { ...offer, id: stableId(986, 3), offeredAt: clock - 15 * 86400000 },
        { ...offer, id: stableId(986, 4), buyerId: sellerId },
      ],
    };
    const reserved = financialLimits(state, own);
    const excluded = financialLimits(state, own, 0, offer.id);
    expect(excluded.transfer - reserved.transfer).toBe(100000);
    state.negotiations = [
      {
        id: stableId(986, 5),
        buyerId: own.id,
        sellerId,
        playerId,
        fee: 0,
        offeredSalary: null,
        interest: 50,
        status: 'salary',
      },
    ];
    expect(financialLimits(state, own)).toMatchObject({
      transfer: reserved.transfer,
      salary: reserved.salary,
    });
  });
  it('recusa contraoferta inválida e proposta que desapareceu antes do aceite', () => {
    expect(
      run({ type: 'management', action: 'counter-offer', offerId: stableId(987, 1), fee: 0 }).ok,
    ).toBe(false);
    expect(
      run({ type: 'management', action: 'counter-offer', offerId: stableId(987, 1), fee: 100000 })
        .ok,
    ).toBe(false);
    expect(
      run({ type: 'management', action: 'accept-transfer', offerId: stableId(987, 1) }).ok,
    ).toBe(false);
    expect(
      run({ type: 'management', action: 'reject-renewal', playerId: stableId(987, 1) }).ok,
    ).toBe(false);
  });
});
