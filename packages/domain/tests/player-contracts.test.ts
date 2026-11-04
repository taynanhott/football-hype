import {
  resetTransferredEffects,
  settleContractDecisions,
} from '../src/game/contract-lifecycle.js';
import { renewalPatience } from '../src/game/player-contracts.js';
import { matchResultSchema, worldStateSchema } from '@football/shared';
import { describe, it, expect } from 'vitest';
import {
  createWorld,
  stableId,
  executeCommand,
  applyEvent,
  temporaryModifiers,
  advanceGameDays,
  playNextBatch,
} from '../src/index.js';
import {
  averageMonthlySalary,
  renewalTerms,
  ageFatigueFactor,
  moraleSensitivity,
  maxContractYears,
} from '../src/game/player-contracts.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
function setup() {
  let state = unwrap(
    createWorld({ id: stableId(991, 1), name: 'Contratos', mode: 'offline', userId: 'host', now }),
  );
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const player = {
    ...state.players.byId[club.playerIds[0]!]!,
    age: 25,
    overall: 75,
    morale: 70,
    salary: { cents: 100000, currency: 'BRL' as const },
    marketValue: { cents: 100000000, currency: 'BRL' as const },
  };
  state = {
    ...state,
    players: { ...state.players, byId: { ...state.players.byId, [player.id]: player } },
    management: { ...state.management, contracts: { [player.id]: now + 100 * 86400000 } },
  };
  return { state, club, player };
}
describe('decisões pessoais de contrato e esforço', () => {
  it('recusa iniciativa do clube em contratos longos ou recém renovados', () => {
    const { state, player } = setup();
    expect(
      renewalTerms(
        {
          ...state,
          management: { ...state.management, contracts: { [player.id]: now + 800 * 86400000 } },
        },
        player,
      ).reason,
    ).toContain('seis meses');
    expect(
      renewalTerms(
        {
          ...state,
          management: {
            ...state.management,
            contractHistory: {
              [player.id]: {
                overall: 75,
                marketValue: 100000000,
                signedAt: now,
                dissatisfied: false,
              },
            },
          },
        },
        player,
      ).reason,
    ).toContain('recentemente');
  });
  it('veteranos aceitam maior redução perto do término e limitam a duração', () => {
    const { state, player } = setup();
    const veteran = {
      ...player,
      age: 35,
      salary: { ...player.salary, cents: 1000000 },
      marketValue: { ...player.marketValue, cents: 1000000 },
    };
    expect(renewalTerms(state, veteran).minimumSalary).toBeLessThan(veteran.salary.cents);
    expect(
      renewalTerms(
        {
          ...state,
          management: { ...state.management, contracts: { [player.id]: now + 400 * 86400000 } },
        },
        veteran,
      ).minimumSalary,
    ).toBeGreaterThanOrEqual(veteran.salary.cents * 0.95);
    expect(maxContractYears(35)).toBe(1);
    expect(maxContractYears(32)).toBe(2);
  });
  it('recusa da valorização gera −8 imediatamente, sem acumular, e pagar o pedido remove', () => {
    const setupValue = setup();
    const player = setupValue.player;
    let state = setupValue.state;
    state = {
      ...state,
      management: {
        ...state.management,
        contractHistory: {
          [player.id]: {
            overall: 70,
            marketValue: 50000000,
            signedAt: now - 200 * 86400000,
            dissatisfied: false,
          },
        },
      },
    };
    expect(renewalTerms(state, player).demand).toBe(true);
    const event = unwrap(
      executeCommand(
        state,
        { type: 'management', action: 'reject-renewal', playerId: player.id },
        'host',
        now,
        stableId(991, 2),
      ),
    );
    state = unwrap(applyEvent(state, event));
    expect(
      temporaryModifiers(state, player).find((e) => e.label === 'Insatisfeito com o contrato')
        ?.value,
    ).toBe(-8);
    expect(
      executeCommand(
        state,
        { type: 'management', action: 'reject-renewal', playerId: player.id },
        'host',
        now,
        stableId(991, 3),
      ).ok,
    ).toBe(false);
    const renewed = unwrap(
      executeCommand(
        state,
        {
          type: 'management',
          action: 'renew',
          playerId: player.id,
          years: 1,
          salary: renewalTerms(state, player).minimumSalary,
        },
        'host',
        now,
        stableId(991, 4),
      ),
    );
    state = unwrap(applyEvent(state, renewed));
    expect(
      temporaryModifiers(state, state.players.byId[player.id]!).some(
        (e) => e.label === 'Insatisfeito com o contrato',
      ),
    ).toBe(false);
  });
  it('jovens de baixo overall são tolerantes, veteranos se desgastam mais', () => {
    const { player } = setup();
    expect(moraleSensitivity({ ...player, age: 20, overall: 65 })).toBe(0.15);
    expect(moraleSensitivity({ ...player, age: 20, overall: 85 })).toBe(1);
    expect(ageFatigueFactor(35)).toBeGreaterThan(ageFatigueFactor(30));
    expect(ageFatigueFactor(30)).toBeGreaterThan(ageFatigueFactor(20));
  });
  it('treino individual intenso evolui mais e cansa mais, sem mudar a carga dos colegas', () => {
    const { state, club, player } = setup();
    const center = state.centers.byId[club.trainingCenterId]!;
    const base = {
      ...state,
      fixtures: [],
      cups: [],
      competitionDraws: [],
      roundCalendarVersion: 1,
      players: {
        ...state.players,
        byId: { ...state.players.byId, [player.id]: { ...player, fitness: 70, potential: 99 } },
      },
    };
    const run = (load: 'light' | 'intense') =>
      advanceGameDays(
        {
          ...base,
          centers: {
            ...state.centers,
            byId: {
              ...state.centers.byId,
              [center.id]: {
                ...center,
                operations: {
                  load: 'moderate',
                  playerLoads: { [player.id]: load },
                  fitness: [],
                  medical: [],
                  individual: [],
                  syringe: false,
                },
              },
            },
          },
        },
        now + 3 * 86400000,
      );
    const light = run('light'),
      intense = run('intense');
    expect(intense.development[player.id]).toBeGreaterThan(light.development[player.id]!);
    expect(intense.players.byId[player.id]!.fitness).toBeLessThan(
      light.players.byId[player.id]!.fitness,
    );
    const colleague = club.playerIds[1]!;
    expect(intense.players.byId[colleague]!.fitness).toBe(light.players.byId[colleague]!.fitness);
    expect(intense.centers.byId[center.id]!.operations?.effort?.[player.id]).toBeGreaterThan(0);
  });
  it('persiste a carga individual após comando, evento e recarregamento', () => {
    const initial = setup();
    let { state } = initial;
    const { club, player } = initial;
    const centerId = club.trainingCenterId;
    for (const target of ['light', 'intense', 'moderate'] as const) {
      const event = unwrap(
        executeCommand(
          state,
          { type: 'management', action: 'center', target, playerId: player.id },
          'host',
          now,
          stableId(992, state.revision + 1),
        ),
      );
      state = unwrap(applyEvent(state, event));
      state = worldStateSchema.parse(JSON.parse(JSON.stringify(state)));
      expect(state.centers.byId[centerId]?.operations?.playerLoads?.[player.id]).toBe(target);
      expect(
        state.centers.byId[centerId]?.operations?.playerLoads?.[club.playerIds[1]!],
      ).toBeUndefined();
    }
  });
});

describe('referência salarial e distribuição de pedidos', () => {
  it('a referência cresce com overall e cai com a idade após o auge', () => {
    expect(averageMonthlySalary(85, 27)).toBeGreaterThan(averageMonthlySalary(75, 27));
    expect(averageMonthlySalary(75, 35)).toBeLessThan(averageMonthlySalary(75, 27));
    expect(averageMonthlySalary(75, 39)).toBeLessThan(averageMonthlySalary(75, 35));
  });
  it('contratos mais curtos têm desconto pequeno e progressivo', () => {
    const { state, player } = setup();
    const short = renewalTerms(state, player, 1).minimumSalary;
    const long = renewalTerms(state, player, 5).minimumSalary;
    expect(short).toBeLessThan(long);
    expect(short / long).toBeGreaterThan(0.94);
    expect(renewalTerms(state, player, 3).minimumSalary).toBeGreaterThan(short);
  });
  it('não pede reajuste no início da carreira ou logo após uma renovação', () => {
    const { state, player } = setup();
    expect(renewalTerms(state, player).demand).toBe(false);
    const recent = {
      ...state,
      management: {
        ...state.management,
        contractHistory: {
          [player.id]: {
            overall: 60,
            marketValue: 1,
            signedAt: now - 20 * 86400000,
            dissatisfied: false,
          },
        },
      },
    };
    expect(renewalTerms(recent, player).demand).toBe(false);
  });
  it('aceita valorização de mercado sem exigir aumento de overall', () => {
    const { state, player } = setup();
    const grown = {
      ...state,
      management: {
        ...state.management,
        contracts: { [player.id]: now + 500 * 86400000 },
        contractHistory: {
          [player.id]: {
            overall: player.overall,
            marketValue: player.marketValue.cents / 2,
            signedAt: now - 200 * 86400000,
            dissatisfied: false,
          },
        },
      },
    };
    expect(renewalTerms(grown, player).demandReason).toBe('growth');
  });
  it('distribui pedidos de contrato vencendo e limita a dois por clube', () => {
    const { state, club, player } = setup();
    const ids = club.playerIds.slice(0, 6);
    const contracts = Object.fromEntries(ids.map((id) => [id, now + 90 * 86400000]));
    const history = Object.fromEntries(
      ids.map((id) => [
        id,
        {
          overall: 75,
          marketValue: 100000000,
          signedAt: now - 200 * 86400000,
          dissatisfied: false,
        },
      ]),
    );
    const ready = {
      ...state,
      management: { ...state.management, contracts, contractHistory: history },
    };
    expect(ids.filter((id) => renewalTerms(ready, ready.players.byId[id]!).demand)).toHaveLength(2);
    const far = {
      ...ready,
      management: {
        ...ready.management,
        contracts: { ...contracts, [player.id]: now + 200 * 86400000 },
      },
    };
    expect(renewalTerms(far, player).demand).toBe(false);
  });
});

describe('renovação voluntária e lesões por partida', () => {
  it('aumento voluntário concede +2 por cinco atuações, sem consumir na folga', () => {
    const { state, club, player } = setup();
    const event = unwrap(
      executeCommand(
        state,
        {
          type: 'management',
          action: 'renew',
          playerId: player.id,
          salary: renewalTerms(state, player).minimumSalary,
          years: 1,
        },
        'host',
        now,
        stableId(991, 91),
      ),
    );
    let next = unwrap(applyEvent(state, event));
    expect(next.management.contractHistory?.[player.id]?.valuedGames).toBe(5);
    expect(
      temporaryModifiers(next, next.players.byId[player.id]!).find(
        (effect) => effect.label === 'Sentido-se valorizado',
      )?.value,
    ).toBe(2);
    const rested = advanceGameDays(next, now + 86400000);
    expect(rested.management.contractHistory?.[player.id]?.valuedGames).toBe(5);
    const opponent = state.clubs.ids.find((id) => id !== club.id)!;
    next = {
      ...next,
      cups: [],
      results: [],
      fixtures: Array.from({ length: 5 }, (_, i) => ({
        id: 'valued-' + i,
        competitionId: 'serie-a',
        round: i + 1,
        homeId: club.id,
        awayId: opponent,
        scheduledAt: now + (i + 1) * 86400000,
      })),
      tactics: { ...next.tactics, [club.id]: { formation: '4-3-3', starters: [player.id] } },
    };
    for (let i = 0; i < 5; i++) {
      next = {
        ...next,
        injuries: {},
        players: {
          ...next.players,
          byId: {
            ...next.players.byId,
            [player.id]: { ...next.players.byId[player.id]!, fitness: 100 },
          },
        },
      };
      next = unwrap(playNextBatch(next, now));
      expect(next.management.contractHistory?.[player.id]?.valuedGames).toBe(4 - i);
    }
    expect(
      temporaryModifiers(next, next.players.byId[player.id]!).some(
        (effect) => effect.label === 'Sentido-se valorizado',
      ),
    ).toBe(false);
  });
  it('não recupera lesões só pela passagem dos dias e conta cada partida do clube', () => {
    const { state, club, player } = setup();
    const injured = { ...state, injuries: { [player.id]: 3 } };
    expect(advanceGameDays(injured, now + 7 * 86400000).injuries[player.id]).toBe(3);
    const opponent = state.clubs.ids.find((id) => id !== club.id)!;
    const scheduled = {
      ...injured,
      cups: [],
      results: [],
      fixtures: [
        {
          id: 'injury-games',
          competitionId: 'serie-a',
          round: 1,
          homeId: club.id,
          awayId: opponent,
          scheduledAt: now + 7 * 86400000,
        },
      ],
    };
    const next = unwrap(playNextBatch(scheduled, now));
    expect(next.injuries[player.id]).toBe(2);
    expect(next.workload[player.id]?.consecutiveMatches ?? 0).toBe(0);
  });
  it('não concede valorização ao aceitar uma exigência ou renovar sem aumento', () => {
    const { state, player } = setup();
    const rich = { ...player, salary: { ...player.salary, cents: 2000000 } };
    const world = {
      ...state,
      players: { ...state.players, byId: { ...state.players.byId, [player.id]: rich } },
    };
    const event = unwrap(
      executeCommand(
        world,
        {
          type: 'management',
          action: 'renew',
          playerId: player.id,
          salary: rich.salary.cents,
          years: 1,
        },
        'host',
        now,
        stableId(991, 92),
      ),
    );
    expect(
      unwrap(applyEvent(world, event)).management.contractHistory?.[player.id]?.valuedGames,
    ).toBe(0);
  });
});

it('limita a iniciativa do clube aos últimos 180 dias e calcula a recusa conforme os anos propostos', () => {
  const { state, player } = setup();
  const early = {
    ...state,
    management: {
      ...state.management,
      contracts: { [player.id]: state.lastProcessedAt + 181 * 86400000 },
    },
  };
  expect(renewalTerms(early, player).reason).toContain('seis meses');
  expect(
    executeCommand(
      early,
      { type: 'management', action: 'renew', playerId: player.id, salary: 10000000, years: 1 },
      'host',
      now,
      stableId(991, 93),
    ).ok,
  ).toBe(false);
  const threshold = {
    ...state,
    management: {
      ...state.management,
      contracts: { [player.id]: state.lastProcessedAt + 180 * 86400000 },
    },
  };
  expect(renewalTerms(threshold, player).reason).toBe('');
  const shortSalary = renewalTerms(threshold, player, 1).minimumSalary;
  expect(shortSalary).toBeLessThan(renewalTerms(threshold, player, 5).minimumSalary);
  expect(
    executeCommand(
      threshold,
      { type: 'management', action: 'renew', playerId: player.id, salary: shortSalary, years: 5 },
      'host',
      now,
      stableId(991, 94),
    ).ok,
  ).toBe(false);
});

describe('recusas e mudança de clube', () => {
  for (const days of [100, 700])
    it('insiste e respeita o limite de recusas com contrato de ' + days + ' dias', () => {
      const initial = setup();
      const { player } = initial;
      let state = {
        ...initial.state,
        management: {
          ...initial.state.management,
          contracts: { [player.id]: now + days * 86400000 },
          contractHistory: {
            [player.id]: {
              overall: 70,
              marketValue: 100,
              signedAt: now - 200 * 86400000,
              dissatisfied: false,
            },
          },
        },
      };
      const patience = renewalPatience(player);
      for (let index = 0; index < patience.refusals; index++) {
        expect(renewalTerms(state, state.players.byId[player.id]!).demand).toBe(true);
        state = unwrap(
          applyEvent(
            state,
            unwrap(
              executeCommand(
                state,
                { type: 'management', action: 'reject-renewal', playerId: player.id },
                'host',
                state.lastProcessedAt,
                stableId(991, 100 + index),
              ),
            ),
          ),
        );
        if (index < patience.refusals - 1) {
          expect(renewalTerms(state, state.players.byId[player.id]!).demand).toBe(false);
          state = {
            ...state,
            lastProcessedAt: state.lastProcessedAt + patience.retryDays * 86400000,
          };
        }
      }
      const history = state.management!.contractHistory![player.id]!;
      expect(history.renewalRefusals).toBe(patience.refusals);
      expect(state.players.byId[player.id]!.morale).toBeLessThan(player.morale);
      if (days === 100) {
        expect(history.refusesRenewal).toBe(true);
        expect(renewalTerms(state, state.players.byId[player.id]!).reason).toContain('decidiu');
        const expired = settleContractDecisions({
          ...state,
          lastProcessedAt: now + days * 86400000,
        });
        expect(expired.players.byId[player.id]!.clubId).toBe(null);
        expect(expired.clubs.byId[initial.club.id]!.playerIds).not.toContain(player.id);
        expect(worldStateSchema.safeParse(expired).success).toBe(true);
      } else {
        expect(history.severeDissatisfaction).toBe(true);
        expect(
          temporaryModifiers(state, state.players.byId[player.id]!).find(
            (effect) => effect.label === 'Insatisfeito com o contrato',
          )?.value,
        ).toBe(-10);
        expect(renewalTerms(state, state.players.byId[player.id]!).reason).toBeFalsy();
      }
    });
  it('limpa efeitos e preserva o desenvolvimento ao trocar de clube', () => {
    const { state, player, club } = setup();
    const buyer = state.clubs.byId[state.clubs.ids.find((id) => id !== club.id)!]!;
    const previous = {
      ...state,
      management: {
        ...state.management,
        contractHistory: {
          [player.id]: {
            overall: player.overall,
            marketValue: player.marketValue.cents,
            signedAt: now,
            dissatisfied: true,
            severeDissatisfaction: true,
            refusesRenewal: true,
            valuedGames: 5,
          },
        },
      },
    };
    const next = resetTransferredEffects(previous, {
      ...previous,
      players: {
        ...previous.players,
        byId: { ...previous.players.byId, [player.id]: { ...player, clubId: buyer.id } },
      },
    });
    expect(temporaryModifiers(next, next.players.byId[player.id]!)).toEqual([]);
    expect(next.positionExperience).toEqual(state.positionExperience);
    expect(next.ratingHistory).toBe(state.ratingHistory);
    expect(next.players.byId[player.id]!.overall).toBe(player.overall);
    expect(next.management!.contractHistory![player.id]!.refusesRenewal).toBeUndefined();
  });
});

it('falta prolongada de jogos pode encerrar a negociação até o vencimento', () => {
  const { state, player, club } = setup();
  const base = {
    ...state,
    management: {
      ...state.management,
      contractHistory: {
        [player.id]: {
          overall: player.overall,
          marketValue: player.marketValue.cents,
          signedAt: 0,
          dissatisfied: false,
        },
      },
    },
    results: Array.from({ length: 8 }, (_, index) =>
      matchResultSchema.parse({
        status: 'finished',
        fixtureId: 'bench-' + index,
        homeId: club.id,
        awayId: state.clubs.ids.find((id) => id !== club.id),
        homeGoals: 0,
        awayGoals: 0,
        attendance: 0,
        revenue: 0,
        scorers: [],
        seed: index,
        lineups: { home: club.playerIds.filter((id) => id !== player.id).slice(0, 11), away: [] },
      }),
    ),
  };
  const next = settleContractDecisions(base);
  expect(next.management!.contractHistory![player.id]!.refusesRenewal).toBe(true);
  expect(next.players.byId[player.id]!.morale).toBe(60);
  const returned = {
    ...next,
    results: [
      ...next.results,
      { ...next.results[0]!, fixtureId: 'return', lineups: { home: [player.id], away: [] } },
    ],
  };
  expect(renewalTerms(returned, returned.players.byId[player.id]!).reason).toContain('decidiu');
  expect(settleContractDecisions(returned).players.byId[player.id]!.morale).toBe(60);
  expect(renewalPatience({ ...player, id: 'even' }).refusals).toBe(2);
  expect(renewalPatience({ ...player, id: 'odd' }).refusals).toBe(3);
});
