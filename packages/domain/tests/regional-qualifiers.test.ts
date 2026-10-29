import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  createWorld,
  importDataset,
  normalizeRoundCalendar,
  scheduleRegionalQualifiers,
  resolveRegionalQualifiers,
  regionalCupForClub,
  realizeCompetitionDraws,
  standings,
} from '../src/index.js';
import { worldStateSchema as schema } from '@football/shared';
const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }): T => {
  if (!r.ok) throw Error(r.error.message);
  return r.value;
};
function prepare() {
  const base = unwrap(
    createWorld({
      id: crypto.randomUUID(),
      userId: 'q-test',
      name: 'Seletiva',
      mode: 'offline',
      now: Date.UTC(2026, 0, 11, 12),
    }),
  );
  const state = normalizeRoundCalendar(
    unwrap(
      importDataset(
        base,
        JSON.parse(
          readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
        ),
      ),
    ),
  );
  return {
    previous: state,
    next: {
      ...state,
      season: 2027,
      results: [],
      lastProcessedAt: Date.UTC(2027, 0, 11, 12),
      roundDates: {},
      roundCalendarVersion: 0,
    },
  };
}
it('cria seletivas regionais em turno único sem reativar a Série D', () => {
  const { previous, next } = prepare();
  const state = normalizeRoundCalendar(scheduleRegionalQualifiers(previous, next));
  expect(
    Object.values(state.clubs.byId)
      .filter((c) => c.country === 'BR')
      .every((c) => regionalCupForClub(c) !== undefined),
  ).toBe(true);
  expect(schema.safeParse(state).success).toBe(true);
  expect(state.fixtures.some((f) => f.competitionId === 'serie-d')).toBe(false);
  expect(state.regionalQualifiers).toHaveLength(3);
  for (const q of state.regionalQualifiers!) {
    expect(q.directIds.every((id) => state.clubs.byId[id]?.division !== 'A')).toBe(true);
    expect(
      [...q.directIds, ...q.candidateIds].every(
        (id) => regionalCupForClub(state.clubs.byId[id]!) === q.cupId,
      ),
    ).toBe(true);
    if (q.qualifiedIds !== undefined) continue;
    const games = state.fixtures.filter((f) => f.competitionId === q.competitionId);
    expect(games.length).toBe((q.candidateIds.length * (q.candidateIds.length - 1)) / 2);
    for (const club of q.candidateIds)
      expect(games.filter((f) => f.homeId === club || f.awayId === club)).toHaveLength(
        q.candidateIds.length - 1,
      );
    for (const round of new Set(games.map((f) => f.round))) {
      const playing = games.filter((f) => f.round === round).flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(playing).size).toBe(playing.length);
      if (q.candidateIds.length % 2) expect(playing.length).toBe(q.candidateIds.length - 1);
    }
  }
});
it('aguarda todos os jogos e leva apenas os classificados ao sorteio regional', () => {
  const { previous, next } = prepare();
  const state = normalizeRoundCalendar(scheduleRegionalQualifiers(previous, next));
  const q = state.regionalQualifiers!.find((q) => q.qualifiedIds === undefined)!;
  const games = state.fixtures.filter((f) => f.competitionId === q.competitionId);
  const results = games.map((f) => ({
    fixtureId: f.id,
    homeId: f.homeId,
    awayId: f.awayId,
    homeGoals: 1,
    awayGoals: 0,
    attendance: 0,
    revenue: 0,
    seed: 1,
    scorers: [],
    status: 'finished',
  }));
  const partial = { ...state, results: results.slice(0, -1) };
  expect(
    resolveRegionalQualifiers(partial).regionalQualifiers!.find(
      (x) => x.competitionId === q.competitionId,
    )?.qualifiedIds,
  ).toBeUndefined();
  const completed = resolveRegionalQualifiers({ ...state, results });
  const winners = standings(q.candidateIds, games, results)
    .slice(0, q.slots)
    .map((row) => row.id);
  expect(
    completed.regionalQualifiers!.find((x) => x.competitionId === q.competitionId)?.qualifiedIds,
  ).toEqual(winners);
  const draw = completed.competitionDraws!.find((d) => d.competitionId === q.cupId)!;
  expect(draw.participantIds).toEqual([...q.directIds, ...winners]);
  expect(draw.participantIds).toHaveLength(16);
  const blocked = realizeCompetitionDraws(partial, Date.UTC(2027, 3, 1));
  expect(
    blocked.competitionDraws!.find((d) => d.competitionId === q.cupId)?.completedAt,
  ).toBeUndefined();
  const realized = realizeCompetitionDraws(completed, Date.UTC(2027, 3, 1));
  expect(
    realized.competitionDraws!.find((d) => d.competitionId === q.cupId)?.completedAt,
  ).toBeDefined();
});
