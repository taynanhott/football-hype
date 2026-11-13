import { beforeAll, describe, expect, it } from 'vitest';
import { commandSchema, GAMEPLAY, type Fixture, type WorldState } from '@football/shared';
import {
  applyEvent,
  createWorld,
  executeCommand,
  matchDemand,
  matchProbabilities,
  playNextBatch,
  scheduledFixtures,
  stableId,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
import { indexDemandResults } from '../src/finance/match-demand.js';

const NOW = Date.parse('2026-10-26T15:00:00Z');
it('preserva público e receita ao compartilhar o índice da rodada', () => {
  const state = unwrap(
    createWorld({ id: IDS.league, userId: IDS.user, name: 'Índice', mode: 'offline', now: NOW }),
  );
  const fixtures = scheduledFixtures(state);
  const index = new Map(fixtures.map((game) => [game.id, game]));
  for (const game of fixtures.slice(0, 30)) {
    expect(matchDemand(state, game, undefined, index)).toEqual(matchDemand(state, game));
  }
});
it('preserva a procura com histórico ao agrupar resultados por clube', () => {
  let state = unwrap(
    createWorld({ id: IDS.league, userId: IDS.user, name: 'Histórico', mode: 'offline', now: NOW }),
  );
  for (let round = 0; round < 4; round++) {
    state = unwrap(playNextBatch(state, NOW + round * 86400000));
    const fixtures = scheduledFixtures(state);
    const index = new Map(fixtures.map((game) => [game.id, game]));
    const results = indexDemandResults(state, index);
    for (const game of fixtures
      .filter((game) => game.scheduledAt >= state.lastProcessedAt)
      .slice(0, 60)) {
      expect(matchDemand(state, game, undefined, index, results)).toEqual(matchDemand(state, game));
    }
  }
});
let initial: WorldState;
let fixture: Fixture;
beforeAll(() => {
  initial = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Bilheteria',
      mode: 'offline',
      now: NOW,
    }),
  );
  const clubId = initial.participants[0]!.clubId;
  fixture = initial.fixtures.find((item) => item.homeId === clubId && !item.neutral)!;
});

describe('procura de ingressos e probabilidades', () => {
  it('delimita a barra com mais público na faixa barata e menos na abusiva', () => {
    const range = matchDemand(initial, fixture);
    expect(matchDemand(initial, fixture, range.selloutPriceCents).occupancy).toBeGreaterThan(0.8);
    expect(matchDemand(initial, fixture, range.minimumCrowdPriceCents).occupancy).toBeLessThan(
      0.25,
    );
  });
  it('reduz a procura com preços maiores e respeita a capacidade', () => {
    const cheap = matchDemand(initial, fixture, 50);
    const normal = matchDemand(initial, fixture, 100);
    const expensive = matchDemand(initial, fixture, 400);
    expect(cheap.attendance).toBeGreaterThanOrEqual(normal.attendance);
    expect(normal.attendance).toBeGreaterThan(expensive.attendance);
    expect(cheap.attendance).toBeLessThanOrEqual(cheap.capacity);
    expect(expensive.attendance).toBeGreaterThanOrEqual(0);
    expect(expensive.ticketRevenue).toBe(expensive.attendance * expensive.priceCents);
  });
  it('aceita preços maiores em uma final e reduz interesse depois de derrotas', () => {
    const finalFixture = { ...fixture, id: 'cup-final', competitionId: 'copa-brasil', round: 5 };
    const finalState = {
      ...initial,
      cups: [{ ...finalFixture, legs: 1 as const, leftId: null, rightId: null, winnerId: null }],
    };
    const regular = matchDemand(initial, fixture, 200);
    const final = matchDemand(finalState, finalFixture, 200);
    expect(final.fairPriceCents).toBeGreaterThan(regular.fairPriceCents);
    expect(final.selloutPriceCents).toBeGreaterThanOrEqual(regular.selloutPriceCents);
    const games = Array.from({ length: 5 }, (_, index) => ({
      ...fixture,
      id: `recent-${index}`,
      scheduledAt: fixture.scheduledAt - (6 - index) * 86400000,
    }));
    const withForm = (homeGoals: number, awayGoals: number): WorldState => ({
      ...initial,
      fixtures: [...games, fixture],
      results: games.map((game) => ({
        fixtureId: game.id,
        status: 'finished',
        homeGoals,
        awayGoals,
        attendance: 1000,
        revenue: 1000,
        seed: 1,
        scorers: [],
      })),
    });
    expect(matchDemand(withForm(0, 2), fixture, 200).attendance).toBeLessThan(
      matchDemand(withForm(2, 0), fixture, 200).attendance,
    );
  });
  it('mostra três probabilidades que somam 100 e distingue mando de campo neutro', () => {
    const odds = matchProbabilities(initial, fixture);
    expect(odds.home + odds.draw + odds.away).toBe(100);
    expect([odds.home, odds.draw, odds.away].every((value) => value >= 0 && value <= 100)).toBe(
      true,
    );
    const neutral = matchProbabilities(initial, { ...fixture, neutral: true });
    expect(odds.home).toBeGreaterThanOrEqual(neutral.home);
  });
});

describe('preço por partida e simulação', () => {
  it('aplica o preço geral a todos os jogos em casa, inclusive novos confrontos', () => {
    const event = unwrap(
      executeCommand(
        initial,
        { type: 'home-ticket-price', priceCents: 200 },
        IDS.user,
        NOW,
        stableId(15, 8),
      ),
    );
    const saved = unwrap(applyEvent(initial, event));
    expect(saved.homeTicketPrices?.[fixture.homeId]).toBe(200);
    const future = {
      ...fixture,
      id: 'new-home-game',
      scheduledAt: fixture.scheduledAt + 7 * 86400000,
    };
    expect(matchDemand(saved, fixture).priceCents).toBe(200);
    expect(matchDemand(saved, future).priceCents).toBe(200);
    expect(matchDemand({ ...saved, ticketPrices: { [fixture.id]: 50 } }, fixture).priceCents).toBe(
      200,
    );
    expect(
      matchDemand(saved, { ...future, homeId: fixture.awayId, awayId: fixture.homeId }).priceCents,
    ).toBe(GAMEPLAY.baseTicketCents);
    expect(matchDemand(saved, { ...future, neutral: true }).priceCents).toBe(
      GAMEPLAY.baseTicketCents,
    );
    expect(
      executeCommand(
        initial,
        { type: 'home-ticket-price', priceCents: 49 },
        IDS.user,
        NOW,
        stableId(15, 9),
      ).ok,
    ).toBe(false);
    expect(
      executeCommand(
        initial,
        { type: 'home-ticket-price', priceCents: 50000001 },
        IDS.user,
        NOW,
        stableId(15, 10),
      ).ok,
    ).toBe(false);
  });
  it('salva o preço e aplica o mesmo público e receita previstos ao jogo', () => {
    const world = { ...initial, fixtures: [fixture], cups: [] };
    const event = unwrap(
      executeCommand(
        world,
        { type: 'ticket-price', fixtureId: fixture.id, priceCents: 200 },
        IDS.user,
        NOW,
        stableId(15, 1),
      ),
    );
    const saved = unwrap(applyEvent(world, event));
    expect(saved.ticketPrices?.[fixture.id]).toBe(200);
    expect(initial.ticketPrices?.[fixture.id]).toBeUndefined();
    const expected = matchDemand(saved, fixture);
    const after = unwrap(playNextBatch(saved, NOW));
    const result = after.results.find((item) => item.fixtureId === fixture.id)!;
    expect(result.attendance).toBe(expected.attendance);
    expect(result.revenue).toBe(expected.revenue);
    expect(result.ticketPriceCents).toBe(200);
  });
  it('rejeita jogos fora, em campo neutro, já disputados e valores inválidos', () => {
    const setPrice = (world: WorldState, priceCents = 100, fixtureId = fixture.id) =>
      executeCommand(
        world,
        { type: 'ticket-price', fixtureId, priceCents },
        IDS.user,
        NOW,
        stableId(15, 2),
      );
    expect(setPrice(initial, 49).ok).toBe(false);
    expect(setPrice(initial, 501).ok).toBe(false);
    expect(setPrice(initial, NaN).ok).toBe(false);
    expect(setPrice(initial, 100, 'missing').ok).toBe(false);
    expect(
      setPrice({
        ...initial,
        fixtures: [{ ...fixture, homeId: fixture.awayId, awayId: fixture.homeId }],
        cups: [],
      }).ok,
    ).toBe(false);
    expect(setPrice({ ...initial, fixtures: [{ ...fixture, neutral: true }], cups: [] }).ok).toBe(
      false,
    );
    // Reaching the game date does not mean the match has already been processed.
    expect(setPrice({ ...initial, lastProcessedAt: fixture.scheduledAt }).ok).toBe(true);
    expect(
      setPrice({
        ...initial,
        results: [
          {
            fixtureId: fixture.id,
            status: 'finished',
            homeGoals: 0,
            awayGoals: 0,
            attendance: 100,
            revenue: 100,
            seed: 1,
            scorers: [],
          },
        ],
      }).ok,
    ).toBe(false);
    expect(
      commandSchema.safeParse({ type: 'ticket-price', fixtureId: fixture.id, priceCents: 50000001 })
        .success,
    ).toBe(false);
  });
  it('mantém mando e estádio nas duas pernas da copa e permite precificar a volta em casa', () => {
    const world: WorldState = {
      ...initial,
      fixtures: [],
      cups: [
        {
          id: 'tie',
          competitionId: 'copa-brasil',
          round: 0,
          homeId: fixture.awayId,
          awayId: fixture.homeId,
          legs: 2,
          scheduledAt: fixture.scheduledAt,
          leftId: null,
          rightId: null,
          winnerId: null,
        },
      ],
    };
    const games = scheduledFixtures(world);
    expect(games[0]?.homeId).toBe(fixture.awayId);
    expect(games[1]?.homeId).toBe(fixture.homeId);
    const event = unwrap(
      executeCommand(
        world,
        { type: 'ticket-price', fixtureId: 'tie', priceCents: 200 },
        IDS.user,
        NOW,
        stableId(15, 3),
      ),
    );
    expect(unwrap(applyEvent(world, event)).ticketPrices?.tie).toBe(200);
  });
});

it('troca lotação por maior receita no primeiro aumento de preço', () => {
  const range = matchDemand(initial, fixture);
  const full = matchDemand(initial, fixture, range.selloutPriceCents);
  const next = matchDemand(initial, fixture, 100);
  expect(full.occupancy).toBeGreaterThan(next.occupancy);
  expect(next.ticketRevenue).toBeGreaterThan(full.ticketRevenue);
  const expensive = matchDemand(initial, fixture, 200);
  expect(expensive.ticketRevenue).toBeGreaterThan(next.ticketRevenue);
  expect(matchDemand(initial, fixture, 400).ticketRevenue).toBeLessThan(expensive.ticketRevenue);
});
