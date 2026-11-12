import { describe, expect, it } from 'vitest';
import { createWorld, executeCommand, applyEvent } from '../src/index.js';
import {
  generateCoachOffers,
  pendingCoachOffers,
  resolveCoachOffer,
} from '../src/game/coach-offers.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

function world() {
  return unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Treinadores',
      mode: 'offline',
      now: Date.UTC(2026, 0, 1, 3),
    }),
  );
}
describe('propostas de treinador', () => {
  it('não oferece troca antes da metade da temporada', () => {
    const state = world();
    expect(generateCoachOffers(state).coachOffers ?? []).toEqual([]);
  });
  it('rejeita proposta inexistente sem alterar participantes ou dinheiro', () => {
    const state = world();
    const before = JSON.stringify(state);
    expect(resolveCoachOffer(state, IDS.user, 'inventada', true).ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('permite recusar e impede repetir a decisão', () => {
    const state = world();
    const member = state.participants[0]!;
    const target = state.clubs.ids.find((id) => id !== member.clubId)!;
    state.coachOffers = [
      {
        id: 'offer',
        userId: member.userId,
        fromClubId: member.clubId,
        clubId: target,
        season: state.season,
        status: 'pending',
      },
    ];
    const result = unwrap(resolveCoachOffer(state, member.userId, 'offer', false));
    expect(result.next.participants).toBe(state.participants);
    expect(result.next.clubs).toBe(state.clubs);
    expect(resolveCoachOffer(result.next, member.userId, 'offer', true).ok).toBe(false);
  });
});

function testWorld() {
  const state = structuredClone(world());
  const member = state.participants[0]!;
  const targets = state.clubs.ids.filter((id) => id !== member.clubId).slice(0, 2);
  for (const [index, id] of targets.entries())
    state.clubs.byId[id] = {
      ...state.clubs.byId[id]!,
      name: index === 0 ? 'Atlético-MG' : 'Flamengo',
      coachName: 'Técnico visitante',
    };
  return { state, member, targets };
}
it('não gera propostas de teste e bloqueia exemplos antigos persistidos', () => {
  const { state, member, targets } = testWorld();
  state.coachOffers = [];
  expect(pendingCoachOffers(state, member.userId)).toEqual([]);
  const id = 'coach-test-antiga';
  state.coachOffers = [
    {
      id,
      userId: member.userId,
      fromClubId: member.clubId,
      clubId: targets[0]!,
      season: state.season,
      status: 'pending',
    },
  ];
  expect(pendingCoachOffers(state, member.userId)).toEqual([]);
  expect(resolveCoachOffer(state, member.userId, id, true).ok).toBe(false);
});

it('aceite cancela decisões pendentes, limpa os planos e entrega o antigo clube ao bot', () => {
  const { state, member, targets } = testWorld();
  const destination = targets[0]!;
  const unrelated = state.clubs.ids.find((id) => id !== member.clubId && !targets.includes(id))!;
  const old = state.clubs.byId[member.clubId]!;
  const plan = {
    formation: '4-4-2' as const,
    starters: old.playerIds.slice(0, 11),
    instructions: {
      substitutions: [
        {
          out: old.playerIds[0]!,
          in: old.playerIds[11]!,
          when: 60 as const,
          score: 'always' as const,
        },
      ],
      protected: [],
      situations: [],
    },
  };
  state.tactics = { [old.id]: plan, [destination]: plan, [unrelated]: plan };
  state.lineupPresets = {
    [old.id]: [{ id: old.id, name: 'Plano antigo', lineup: plan }],
    [destination]: [],
    [unrelated]: [],
  };
  const negotiation = {
    id: old.id,
    buyerId: old.id,
    sellerId: unrelated,
    playerId: old.playerIds[0]!,
    fee: 100,
    offeredSalary: null,
    interest: 50,
    status: 'review' as const,
  };
  state.negotiations = [
    negotiation,
    {
      ...negotiation,
      id: destination,
      buyerId: unrelated,
      sellerId: destination,
      status: 'salary',
    },
    {
      ...negotiation,
      id: unrelated,
      buyerId: unrelated,
      sellerId: targets[1],
      status: 'completed',
    },
  ];
  state.management = {
    ...state.management,
    offers: [
      {
        id: 'pending-loan',
        buyerId: unrelated,
        sellerId: old.id,
        playerId: old.playerIds[1]!,
        fee: 0,
        salary: 100,
        kind: 'loan',
        status: 'pending',
      },
      {
        id: 'completed',
        buyerId: unrelated,
        sellerId: old.id,
        playerId: old.playerIds[2]!,
        fee: 100,
        salary: 100,
        status: 'accepted',
      },
    ],
  };
  state.clubs = {
    ...state.clubs,
    byId: {
      ...state.clubs.byId,
      ...Object.fromEntries(
        targets.map((id) => [
          id,
          { ...state.clubs.byId[id]!, division: old.division, country: 'BR' },
        ]),
      ),
    },
  };
  const competitionId = state.fixtures.find(
    (f) => f.homeId === old.id || f.awayId === old.id,
  )!.competitionId;
  const template = state.fixtures[0]!;
  state.fixtures = targets.flatMap((id) =>
    Array.from({ length: 19 }, (_, i) => ({
      ...template,
      id: id + '-played-' + i,
      homeId: old.id,
      awayId: id,
      competitionId,
    })),
  );
  state.results = state.fixtures.map(
    (f) => ({ fixtureId: f.id, homeGoals: 2, awayGoals: 0 }) as (typeof state.results)[number],
  );
  state.coachOffers = targets.map((id) => ({
    id: 'regular-' + id,
    userId: member.userId,
    fromClubId: old.id,
    clubId: id,
    season: state.season,
    status: 'pending' as const,
  }));
  const before = structuredClone(state);
  const offer = pendingCoachOffers(state, member.userId).find((o) => o.clubId === destination)!;
  const event = unwrap(
    executeCommand(
      state,
      { type: 'coach-offer', offerId: offer.id, accept: true },
      member.userId,
      Date.now(),
      IDS.league,
    ),
  );
  const next = unwrap(applyEvent(state, event));
  expect(next.coachOffers!.filter((o) => o.status === 'pending')).toHaveLength(0);
  expect(next.coachOffers!.some((o) => o.clubId === targets[1] && o.status === 'rejected')).toBe(
    true,
  );
  expect(next.negotiations.map((o) => o.status)).toEqual(['rejected', 'rejected', 'completed']);
  expect(next.management!.offers!.map((o) => o.status)).toEqual(['rejected', 'accepted']);
  expect(next.tactics[destination]).toBeUndefined();
  expect(next.lineupPresets[old.id]).toBeUndefined();
  expect(next.lineupPresets[destination]).toBeUndefined();
  expect(next.tactics[old.id]?.instructions).toBeUndefined();
  expect(next.tactics[old.id]?.starters).toHaveLength(11);
  expect(next.tactics[unrelated]).toEqual(plan);
  expect(next.lineupPresets[unrelated]).toEqual([]);
  expect(next.players).toEqual(state.players);
  for (const id of state.clubs.ids)
    expect(next.clubs.byId[id]!.balance).toEqual(state.clubs.byId[id]!.balance);
  expect(pendingCoachOffers(generateCoachOffers(next), member.userId)).toHaveLength(0);
  expect(pendingCoachOffers({ ...next, season: next.season + 1 }, member.userId).length).toBe(0);
  expect(state).toEqual(before);
});
