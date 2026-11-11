import { describe, expect, it } from 'vitest';
import { matchResultSchema, worldStateSchema, type MatchResult } from '@football/shared';
import {
  createWorld,
  playerAvailable,
  playerSuspension,
  resolveLineup,
  resolveBench,
  playNextBatch,
} from '../src/index.js';
import { settleMatchDiscipline } from '../src/game/discipline.js';
import { handleCommand } from '../src/game/command-handlers.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const now = Date.parse('2026-04-02T18:00:00-03:00');
const eventId = '00000000-0000-4000-8000-00000000000a';
function setup() {
  const state = unwrap(
    createWorld({ id: IDS.league, userId: IDS.user, name: 'Cartões', mode: 'offline', now }),
  );
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const opponent = state.clubs.ids.find(
    (id) => id !== club.id && state.clubs.byId[id]?.country === 'BR',
  )!;
  const player = club.playerIds[0]!;
  const fixture = {
    id: 'discipline-game',
    competitionId: 'serie-a',
    round: 0,
    homeId: club.id,
    awayId: opponent,
    scheduledAt: now,
  };
  state.fixtures = [fixture];
  state.cups = [];
  state.competitionDraws = [];
  state.roundCalendarVersion = 1;
  state.roundDates = { 'serie-a:league:0': now };
  state.lastProcessedAt = now;
  state.nextScheduledAt = now;
  state.seasonClock = undefined;
  const result = (types: Array<'yellow' | 'red'>): MatchResult =>
    matchResultSchema.parse({
      fixtureId: fixture.id,
      homeGoals: 0,
      awayGoals: 0,
      attendance: 0,
      revenue: 0,
      seed: 1,
      scorers: [],
      lineups: { home: [player], away: [] },
      actions: types.map((type, i) => ({
        type,
        playerId: player,
        side: 'home',
        minute: 20 + i,
        x: 0,
        z: 0,
      })),
    });
  return { state, club, player, fixture, result };
}
describe('disciplina por competição', () => {
  it('bloqueia escalações enviadas diretamente ao servidor com atleta suspenso', () => {
    const { state, club, player, fixture, result } = setup();
    const lineup = resolveLineup(state, club, now).map((e) => e.player!.id);
    const starters = [player, ...lineup.filter((id) => id !== player)].slice(0, 11);
    const banned = settleMatchDiscipline(state, fixture, result(['red']));
    expect(
      handleCommand({
        state: banned,
        club,
        command: { type: 'lineup', formation: '4-3-3', starters, bench: [] },
        userId: IDS.user,
        now,
        eventId,
      }).ok,
    ).toBe(false);
  });
  it('zera amarelos na nova temporada e conserva suspensões pendentes', () => {
    const { state, club, player } = setup();
    const other = club.playerIds[1]!;
    const finished = {
      ...state,
      status: 'finished' as const,
      participants: state.participants.map((p) => ({ ...p, ready: true })),
      discipline: {
        version: 1 as const,
        competitions: {
          'serie-a': {
            [player]: { yellowCards: 2, suspendedGames: 1 },
            [other]: { yellowCards: 2, suspendedGames: 0 },
          },
        },
      },
    };
    const next = unwrap(
      handleCommand({
        state: finished,
        club,
        command: { type: 'new-season' },
        userId: IDS.user,
        now,
        eventId,
      }),
    ).next;
    expect(next.discipline?.competitions['serie-a']?.[player]).toEqual({
      yellowCards: 0,
      suspendedGames: 1,
    });
    expect(next.discipline?.competitions['serie-a']?.[other]).toBeUndefined();
  });
  it('três amarelos geram exatamente um jogo e reiniciam a contagem', () => {
    const { state, player, fixture, result } = setup();
    const one = settleMatchDiscipline(state, fixture, result(['yellow']));
    expect(one.discipline?.competitions['serie-a']?.[player]).toEqual({
      yellowCards: 1,
      suspendedGames: 0,
    });
    const two = settleMatchDiscipline(one, { ...fixture, id: 'second' }, result(['yellow']));
    expect(playerAvailable(two, player, now, 'serie-a')).toBe(true);
    const three = settleMatchDiscipline(two, { ...fixture, id: 'third' }, result(['yellow']));
    expect(three.discipline?.competitions['serie-a']?.[player]).toEqual({
      yellowCards: 0,
      suspendedGames: 1,
    });
    expect(three.clubs).toBe(state.clubs);
    expect(three.injuries).toBe(state.injuries);
    expect(worldStateSchema.safeParse(three).success).toBe(true);
  });
  it('vermelho suspende uma vez, inclusive com amarelo na mesma partida', () => {
    const { state, player, fixture, result } = setup();
    const next = settleMatchDiscipline(state, fixture, result(['yellow', 'red']));
    expect(playerSuspension(next, player, 'serie-a')).toBe(1);
    expect(next.discipline?.competitions['serie-a']?.[player]?.yellowCards).toBe(0);
  });
  it('não bloqueia outra competição e só cumpre o jogo pelo próprio clube na competição correta', () => {
    const { state, player, fixture, result } = setup();
    const banned = settleMatchDiscipline(state, fixture, result(['red']));
    expect(playerAvailable(banned, player, now, 'serie-a')).toBe(false);
    expect(playerAvailable(banned, player, now, 'copa-brasil')).toBe(true);
    const cup = settleMatchDiscipline(
      banned,
      { ...fixture, competitionId: 'copa-brasil' },
      result([]),
    );
    expect(playerSuspension(cup, player, 'serie-a')).toBe(1);
    const otherClub = state.clubs.ids.find((id) => id !== fixture.homeId && id !== fixture.awayId)!;
    const unrelated = settleMatchDiscipline(cup, { ...fixture, homeId: otherClub }, result([]));
    expect(playerSuspension(unrelated, player, 'serie-a')).toBe(1);
    const served = settleMatchDiscipline(unrelated, fixture, result([]));
    expect(playerAvailable(served, player, now, 'serie-a')).toBe(true);
  });
  it('substitui o suspenso no jogo real, cumpre a pena e permite seu retorno automático', () => {
    const { state, club, player, fixture, result } = setup();
    const lineup = resolveLineup(state, club, now).map((e) => e.player!.id);
    const preferred = [player, ...lineup.filter((id) => id !== player)].slice(0, 11);
    state.tactics = {
      ...state.tactics,
      [club.id]: { formation: '4-3-3', starters: preferred, bench: [] },
    };
    const banned = settleMatchDiscipline(state, fixture, result(['red']));
    const selected = resolveLineup(banned, club, now).map((e) => e.player!.id);
    expect(selected).not.toContain(player);
    expect(resolveBench(banned, club, now, selected)).not.toContain(player);
    const next = unwrap(playNextBatch(banned, now));
    const actual = next.results.find((r) => r.fixtureId === fixture.id)!;
    expect(actual.lineups?.home).not.toContain(player);
    expect(actual.tacticalPlans?.home?.bench).not.toContain(player);
    expect(actual.substitutions?.map((s) => s.in) ?? []).not.toContain(player);
    expect(playerSuspension(next, player, 'serie-a')).toBe(0);
    expect(
      resolveLineup(next, club, now, undefined, undefined, undefined, undefined, 'serie-a').map(
        (e) => e.player!.id,
      ),
    ).toContain(player);
    const restored = worldStateSchema.parse(JSON.parse(JSON.stringify(next)));
    expect(playerSuspension(restored, player, 'serie-a')).toBe(0);
    const replay = playNextBatch(restored, now);
    if (replay.ok) {
      expect(replay.value.results.filter((r) => r.fixtureId === fixture.id)).toHaveLength(1);
      expect(playerSuspension(replay.value, player, 'serie-a')).toBe(0);
    }
  });
});
