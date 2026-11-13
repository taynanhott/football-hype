import { beforeEach, expect, it } from 'vitest';
import { type WorldState, type GameCommand, worldStateSchema } from '@football/shared';
import {
  createWorld,
  stableId,
  executeCommand,
  applyEvent,
  advanceGameDays,
  transferContext,
  loanTerms,
  canLearnPosition,
  learnedPositionFactor,
  playNextBatch,
  startingAverage,
  matchDemand,
  matchProbabilities,
  lineupTacticalBonus,
  resolveLineup,
} from '../src/index.js';
import { unwrap, withTransferReserves } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
let state: WorldState;
it('entrosamento concede de 1 a 3 de bônus ao overall final', () => {
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const lineup = resolveLineup(state, club, state.lastProcessedAt);
  expect(lineupTacticalBonus(lineup.map((e) => ({ ...e, chemistry: 0 })))).toBe(1);
  expect(lineupTacticalBonus(lineup.map((e) => ({ ...e, chemistry: 50 })))).toBe(2);
  expect(lineupTacticalBonus(lineup.map((e) => ({ ...e, chemistry: 100 })))).toBe(3);
  expect(lineupTacticalBonus([])).toBe(0);
});
beforeEach(() => {
  state = unwrap(
    createWorld({
      id: stableId(909, 1),
      userId: 'host',
      name: 'Mercado',
      mode: 'multiplayer',
      now,
    }),
  );
  state = withTransferReserves(state);
});
function act(command: GameCommand, user = 'host') {
  state = unwrap(
    applyEvent(
      state,
      unwrap(executeCommand(state, command, user, now, stableId(909, state.revision + 100))),
    ),
  );
}
function setupHumanOffer(fee?: number) {
  const buyer = state.clubs.byId[state.participants[0]!.clubId]!;
  const seller = Object.values(state.clubs.byId).find((c) => c.id !== buyer.id)!;
  const original = state.players.byId[seller.playerIds.at(-1)!]!;
  const player = { ...original, overall: 40, potential: 42, age: 28 };
  state = {
    ...state,
    participants: [...state.participants, { userId: 'seller', clubId: seller.id, ready: false }],
    players: { ...state.players, byId: { ...state.players.byId, [player.id]: player } },
    management: {
      ...state.management,
      policies: { [player.id]: { available: true, rivals: true, interest: 75 } },
    },
  };
  const context = transferContext(state, player, buyer);
  act({ type: 'offer', playerId: player.id, fee: fee ?? context.minimumFee });
  return { buyer, seller, player, id: state.negotiations.at(-1)!.id };
}
it('aguarda o técnico humano e só libera salário após sua resposta', () => {
  const { id } = setupHumanOffer();
  state = advanceGameDays(state, now + 8 * 86400000);
  expect(state.negotiations.find((n) => n.id === id)?.status).toBe('review');
  expect(
    executeCommand(
      state,
      { type: 'salary', negotiationId: id, salary: 1000000 },
      'host',
      now,
      stableId(910, 1),
    ).ok,
  ).toBe(false);
  act({ type: 'management', action: 'accept-transfer', offerId: id }, 'seller');
  expect(state.negotiations.find((n) => n.id === id)?.status).toBe('salary');
});
it('expira a proposta em duas semanas do calendário do jogo', () => {
  const { id } = setupHumanOffer();
  state = advanceGameDays(state, now + 14 * 86400000);
  expect(state.negotiations.find((n) => n.id === id)?.status).toBe('rejected');
  expect(
    executeCommand(
      state,
      { type: 'management', action: 'accept-transfer', offerId: id },
      'seller',
      now,
      stableId(910, 2),
    ).ok,
  ).toBe(false);
});
it('reduz ao mínimo o interesse de uma estrela por um elenco muito inferior', () => {
  const buyer = state.clubs.byId[state.participants[0]!.clubId]!;
  const original = Object.values(state.players.byId).find(
    (p) => p.clubId && p.clubId !== buyer.id,
  )!;
  const player = { ...original, overall: 94, potential: 95 };
  const players = { ...state.players.byId, [player.id]: player };
  for (const id of buyer.playerIds) players[id] = { ...players[id]!, overall: 55 };
  state = { ...state, players: { ...state.players, byId: players } };
  expect(transferContext(state, player, buyer).playerInterest).toBe(1);
});
it('IA não coloca titulares importantes nem promessas em empréstimo', () => {
  const club = Object.values(state.clubs.byId).find(
    (c) => !state.participants.some((p) => p.clubId === c.id),
  )!;
  const squad = club.playerIds
    .map((id) => state.players.byId[id]!)
    .sort((a, b) => b.overall - a.overall);
  expect(loanTerms(state, squad[0]!).eligible).toBe(false);
  expect(loanTerms(state, { ...squad.at(-1)!, age: 20, potential: 99 }).eligible).toBe(false);
});
it('aprende somente posições compatíveis e termina a adaptação na 15ª partida', () => {
  expect(canLearnPosition('ST', 'CB')).toBe(false);
  expect(canLearnPosition('LW', 'LB')).toBe(true);
  expect(canLearnPosition('LW', 'CB')).toBe(false);
  expect(canLearnPosition('CM', 'LW')).toBe(true);
  expect(canLearnPosition('CM', 'ST')).toBe(false);
  expect(canLearnPosition('GK', 'ST')).toBe(false);
  const original = Object.values(state.players.byId)[0]!;
  const player = { ...original, position: 'LW' as const };
  expect(learnedPositionFactor(state, player, 'LB')).toBe(0.85);
  state = { ...state, positionExperience: { [player.id]: { LB: 15, CB: 15 } } };
  expect(learnedPositionFactor(state, player, 'LB')).toBe(1);
  expect(learnedPositionFactor(state, player, 'CB')).toBe(0.45);
  expect(worldStateSchema.safeParse(state).success).toBe(true);
});
it('registra uma única aparição de adaptação por atleta e partida', () => {
  state = unwrap(playNextBatch(state, now));
  const values = Object.values(state.positionExperience ?? {}).flatMap((positions) =>
    Object.values(positions),
  );
  expect(values.length).toBeGreaterThan(0);
  expect(values.every((value) => value === 1)).toBe(true);
});

it('aplica penalidades individuais à média titular e às probabilidades', () => {
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const fixture = state.fixtures.find((f) => f.homeId === club.id)!;
  const before = startingAverage(state, club);
  const odds = matchProbabilities(state, fixture);
  state = { ...state, management: { ...state.management, wageDebts: { [club.id]: 100000 } } };
  expect(startingAverage(state, club)).toBeLessThan(before);
  const after = matchProbabilities(state, fixture);
  expect(after.homeStrength).toBeLessThan(odds.homeStrength);
  expect(after.awayStrength).toBe(odds.awayStrength);
});
it('usa a bilheteria somente da casa na força da torcida', () => {
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const fixture = state.fixtures.find((f) => f.homeId === club.id)!;
  const range = matchDemand(state, fixture);
  state = { ...state, homeTicketPrices: { [club.id]: range.selloutPriceCents } };
  const full = matchProbabilities(state, fixture);
  const other = {
    ...state,
    homeTicketPrices: { ...state.homeTicketPrices, [fixture.awayId]: 50000 },
  };
  expect(matchProbabilities(other, fixture)).toEqual(full);
  const costly = { ...state, homeTicketPrices: { [club.id]: 100 } };
  const lower = matchProbabilities(costly, fixture);
  expect(full.homeOccupancy).toBeGreaterThan(lower.homeOccupancy);
  expect(lower.homeOccupancy).toBeGreaterThan(0);
  expect(lower.home).toBeLessThanOrEqual(full.home);
  expect(full.homeStrength).toBeGreaterThan(lower.homeStrength);
  expect(full.awayStrength).toBe(lower.awayStrength);
  const neutral = matchProbabilities(state, { ...fixture, neutral: true });
  expect(neutral.homeCrowdBonus).toBe(0);
  expect(neutral.homeStrength).toBeLessThan(full.homeStrength);
  expect(matchProbabilities(costly, { ...fixture, neutral: true }).homeStrength).toBe(
    neutral.homeStrength,
  );
});

it('deixa o preço da proposta para o técnico humano decidir', () => {
  const { id } = setupHumanOffer(0);
  expect(state.negotiations.find((n) => n.id === id)?.status).toBe('review');
  act({ type: 'management', action: 'accept-transfer', offerId: id }, 'seller');
  expect(state.negotiations.find((n) => n.id === id)?.status).toBe('salary');
});
