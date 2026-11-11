import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  europeanLeaguesSchema,
  worldStateSchema,
  stateChanges,
  applyStateChanges,
  type WorldDataset,
  type WorldState,
} from '@football/shared';
import {
  createWorld,
  createEuropeanLeagues,
  europeanFixtures,
  europeanLeagueView,
  advanceEuropeanLeagues,
  europeanRoundDate,
  europeanQualifiers,
  championsParticipants,
  europeanTransferPressure,
  pendingFixtures,
  scheduledFixtures,
  transferContext,
  executeCommand,
  applyEvent,
  stableId,
  seasonSchedule,
  advanceGameDays,
  importDataset,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const dataset = JSON.parse(
  readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
) as WorldDataset;
const clubs = Object.values(dataset.clubs.byId);
function world(): WorldState {
  const state = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Europa',
      mode: 'offline',
      now: Date.UTC(2026, 0, 11),
    }),
  );
  const own = clubs.find((club) => club.country === 'BR' && club.division === 'A')!;
  return {
    ...state,
    clubs: dataset.clubs,
    players: dataset.players,
    centers: dataset.centers,
    stadiums: dataset.stadiums,
    fixtures: [],
    cups: [],
    competitionDraws: [],
    results: [],
    participants: [{ userId: IDS.user, clubId: own.id, ready: false }],
    europeanLeagues: createEuropeanLeagues(clubs, 2026),
  };
}

describe('ligas europeias paralelas', () => {
  it('follows rescheduled Serie A rounds without rewriting completed European games', () => {
    const first = advanceEuropeanLeagues(world(), europeanRoundDate(2026, 0));
    const league = first.europeanLeagues!.leagues[0]!;
    const historical = europeanFixtures(league, 2026)[0]!.scheduledAt;
    const postponed = europeanRoundDate(2026, 1) + 86400000;
    const fixture = europeanFixtures(league, 2026)[10]!;
    const state = {
      ...first,
      fixtures: [
        { ...fixture, id: 'national-round-1', competitionId: 'serie-a', scheduledAt: postponed },
      ],
    };
    const waiting = advanceEuropeanLeagues(state, postponed - 1);
    expect(waiting.europeanLeagues!.leagues[0]!.scores).toHaveLength(1);
    const next = advanceEuropeanLeagues(waiting, postponed);
    for (const updated of next.europeanLeagues!.leagues) {
      expect(updated.scores).toHaveLength(2);
      expect(europeanFixtures(updated, 2026)[10]!.scheduledAt).toBe(postponed);
      expect(europeanFixtures(updated, 2026)[0]!.scheduledAt).toBe(historical);
    }
    expect(next.europeanLeagues!.leagues[0]!.scores[0]).toEqual(league.scores[0]);
    expect(advanceEuropeanLeagues(next, postponed)).toBe(next);
  });
  it('includes all five leagues from the first season when a new career imports the real dataset', () => {
    const initial = unwrap(
      createWorld({
        id: IDS.league,
        userId: IDS.user,
        name: 'Primeira temporada',
        mode: 'offline',
        now: Date.UTC(2026, 10, 11),
      }),
    );
    const imported = unwrap(importDataset(initial, dataset));
    expect(imported.season).toBe(2026);
    expect(imported.seasonArchives).toBeUndefined();
    expect(imported.europeanLeagues?.leagues).toHaveLength(5);
    expect(
      imported.europeanLeagues?.leagues.every(
        (league) => league.clubIds.length === 20 && league.scores.length === 0,
      ),
    ).toBe(true);
    expect(imported.europeanLeagues?.season).toBe(imported.season);
  });
  it('reuses 100 existing real squads, with 38 balanced rounds and no duplicate ownership', () => {
    const state = world();
    expect(europeanLeaguesSchema.safeParse(state.europeanLeagues).success).toBe(true);
    expect(state.europeanLeagues!.leagues).toHaveLength(5);
    const ids = state.europeanLeagues!.leagues.flatMap((league) => league.clubIds);
    expect(new Set(ids).size).toBe(100);
    for (const league of state.europeanLeagues!.leagues) {
      const fixtures = europeanFixtures(league, 2026);
      expect(fixtures).toHaveLength(380);
      expect(new Set(fixtures.map((f) => f.id)).size).toBe(380);
      for (let round = 0; round < 38; round++) {
        const games = fixtures.filter((f) => f.round === round);
        expect(games).toHaveLength(10);
        expect(new Set(games.flatMap((f) => [f.homeId, f.awayId])).size).toBe(20);
      }
      for (const id of league.clubIds) {
        expect(fixtures.filter((f) => f.homeId === id)).toHaveLength(19);
        expect(fixtures.filter((f) => f.awayId === id)).toHaveLength(19);
        expect(
          state.clubs.byId[id]!.playerIds.every((pid) => state.players.byId[pid]!.clubId === id),
        ).toBe(true);
      }
    }
  });

  it('does not replace missing clubs, create athletes or modify legacy seasons', () => {
    expect(
      createEuropeanLeagues(
        clubs.filter((club) => club.name !== 'Arsenal'),
        2026,
      ).leagues,
    ).toHaveLength(4);
    const legacy = world();
    delete legacy.europeanLeagues;
    expect(advanceEuropeanLeagues(legacy, europeanRoundDate(2026, 37))).toBe(legacy);
  });

  it('calculates only due rounds, survives persistence/retries and keeps full matches/finances untouched', () => {
    const state = world();
    expect(advanceEuropeanLeagues(state, europeanRoundDate(2026, 0) - 1)).toBe(state);
    const first = advanceEuropeanLeagues(state, europeanRoundDate(2026, 0));
    expect(first.europeanLeagues!.leagues.every((league) => league.scores.length === 1)).toBe(true);
    const resumed = {
      ...first,
      europeanLeagues: europeanLeaguesSchema.parse(
        JSON.parse(JSON.stringify(first.europeanLeagues)),
      ),
    };
    const next = advanceEuropeanLeagues(resumed, europeanRoundDate(2026, 8));
    expect(next.europeanLeagues!.leagues.every((league) => league.scores.length === 9)).toBe(true);
    expect(next.europeanLeagues).toEqual(
      advanceEuropeanLeagues(state, europeanRoundDate(2026, 8)).europeanLeagues,
    );
    expect(advanceEuropeanLeagues(next, europeanRoundDate(2026, 8))).toBe(next);
    expect(next.players).toBe(state.players);
    expect(next.clubs).toBe(state.clubs);
    expect(next.fixtures).toBe(state.fixtures);
    expect(next.results).toBe(state.results);
    expect(next.ratingHistory).toBe(state.ratingHistory);
    expect(scheduledFixtures(next)).toHaveLength(0);
    expect(pendingFixtures(next)).toHaveLength(0);
    const changes = stateChanges(first, next);
    expect(changes.every((change) => change.path[0] === 'europeanLeagues')).toBe(true);
    expect(applyStateChanges(first, changes)).toEqual(next);
    expect(JSON.stringify(next.europeanLeagues).length).toBeLessThan(8192);
  });

  it('completes 1,900 score-only games, coherent standings and exactly 20 earned Champions places', () => {
    const state = advanceEuropeanLeagues(world(), europeanRoundDate(2026, 37));
    let games = 0;
    for (const league of state.europeanLeagues!.leagues) {
      const view = europeanLeagueView(league, 2026);
      games += view.results.length;
      expect(view.table.every((row) => row.played === 38)).toBe(true);
      expect(view.table.reduce((sum, row) => sum + row.goalsFor - row.goalsAgainst, 0)).toBe(0);
      expect(
        view.results.every(
          (result) => !result.actions && !result.startedAt && !result.lineups && !result.ratings,
        ),
      ).toBe(true);
    }
    expect(games).toBe(1900);
    expect(europeanQualifiers(state.europeanLeagues)).toHaveLength(20);
    expect(europeanQualifiers(world().europeanLeagues)).toBeUndefined();
    expect(JSON.stringify(state.europeanLeagues).length).toBeLessThan(16384);
  });

  it('uses 20 earned places and rotates 12 eligible outsiders without duplicates', () => {
    const state = advanceEuropeanLeagues(world(), europeanRoundDate(2026, 37));
    const qualified = europeanQualifiers(state.europeanLeagues)!;
    const first = championsParticipants(clubs, 2027, qualified);
    const second = championsParticipants(clubs, 2028, qualified);
    expect(first).toHaveLength(32);
    expect(new Set(first).size).toBe(32);
    expect(first.slice(0, 20)).toEqual(qualified);
    expect(first.slice(20)).not.toEqual(second.slice(20));
    expect(
      first
        .slice(20)
        .every((id) => !['GB', 'FR', 'DE', 'ES', 'IT'].includes(state.clubs.byId[id]!.country)),
    ).toBe(true);
    expect(championsParticipants(clubs, 2027, qualified)).toEqual(first);
    const schedule = seasonSchedule(clubs, Date.UTC(2027, 0, 11), {
      libertadores: [],
      sulAmericana: [],
      champions: qualified,
    });
    const participants = new Set(
      schedule.fixtures
        .filter((f) => f.competitionId === 'europa')
        .flatMap((f) => [f.homeId, f.awayId]),
    );
    expect(participants.size).toBe(32);
    expect(qualified.every((id) => participants.has(id))).toBe(true);
  });

  it('caps sporting pressure and exposes the same reason to market previews and server validation', () => {
    const state = advanceEuropeanLeagues(world(), europeanRoundDate(2026, 37));
    const league = state.europeanLeagues!.leagues[0]!;
    const table = europeanLeagueView(league, 2026).table;
    expect(europeanTransferPressure(state, table[0]!.id)).toBe(-8);
    expect(europeanTransferPressure(state, table[19]!.id)).toBe(8);
    expect(europeanTransferPressure(world(), table[19]!.id)).toBe(0);
    const seller = state.clubs.byId[table[19]!.id]!;
    const player = state.players.byId[seller.playerIds[0]!]!;
    const buyer = state.clubs.byId[state.participants[0]!.clubId]!;
    expect(transferContext(state, player, buyer).playerReasons).toContainEqual({
      label: 'Classificação do clube na liga europeia',
      value: 8,
    });
  });

  it('archives scores, preserves club ownership and activates the next season with earned Champions entrants', () => {
    const state = {
      ...advanceEuropeanLeagues(world(), europeanRoundDate(2026, 37)),
      status: 'finished' as const,
      participants: world().participants.map((p) => ({ ...p, ready: true })),
    };
    const event = unwrap(
      executeCommand(
        state,
        { type: 'new-season' },
        IDS.user,
        Date.UTC(2026, 11, 20),
        stableId(9, 999),
      ),
    );
    const next = unwrap(applyEvent(state, event));
    expect(next.seasonArchives!.at(-1)!.europeanLeagues).toEqual(state.europeanLeagues);
    expect(next.europeanLeagues!.season).toBe(2027);
    expect(next.europeanLeagues!.leagues.every((league) => league.scores.length === 0)).toBe(true);
    const qualified = europeanQualifiers(state.europeanLeagues)!;
    const entrants = new Set(
      next.fixtures
        .filter((f) => f.competitionId === 'europa')
        .flatMap((f) => [f.homeId, f.awayId]),
    );
    expect(qualified.every((id) => entrants.has(id))).toBe(true);
    for (const league of next.europeanLeagues!.leagues)
      for (const id of league.clubIds)
        expect(next.clubs.byId[id]!.playerIds).toEqual(state.clubs.byId[id]!.playerIds);
    expect(worldStateSchema.shape.europeanLeagues.safeParse(next.europeanLeagues).success).toBe(
      true,
    );
  });

  it('hooks due rounds into the existing calendar advance without introducing scheduled full fixtures', () => {
    const state = world();
    const target = europeanRoundDate(2026, 0);
    // Same game day avoids unrelated daily training work in this integration check.
    const next = advanceGameDays({ ...state, lastProcessedAt: target }, target);
    expect(next.europeanLeagues!.leagues.every((league) => league.scores.length === 1)).toBe(true);
    expect(next.fixtures).toHaveLength(0);
  });

  it('keeps results identical when advancing days individually or across several training days', () => {
    const initial = world();
    const league = initial.europeanLeagues!.leagues[0]!;
    const ids = new Set(league.clubIds);
    const clubList = clubs.filter((club) => ids.has(club.id));
    const playerList = Object.values(initial.players.byId).filter(
      (player) => player.clubId && ids.has(player.clubId),
    );
    const centerList = Object.values(initial.centers.byId).filter((center) =>
      ids.has(center.clubId),
    );
    const state: WorldState = {
      ...initial,
      clubs: {
        ids: clubList.map((club) => club.id),
        byId: Object.fromEntries(clubList.map((club) => [club.id, club])),
      },
      players: {
        ids: playerList.map((player) => player.id),
        byId: Object.fromEntries(playerList.map((player) => [player.id, player])),
      },
      centers: {
        ids: centerList.map((center) => center.id),
        byId: Object.fromEntries(centerList.map((center) => [center.id, center])),
      },
      europeanLeagues: { season: 2026, leagues: [league] },
      lastProcessedAt: europeanRoundDate(2026, 0) - 86400000,
    };
    const end = europeanRoundDate(2026, 2);
    const direct = advanceGameDays(state, end);
    let incremental = state;
    for (let target = state.lastProcessedAt + 86400000; target < end; target += 86400000)
      incremental = advanceGameDays(incremental, target);
    expect(advanceGameDays(incremental, end).europeanLeagues).toEqual(direct.europeanLeagues);
  });
});
