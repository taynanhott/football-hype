import { describe, expect, it } from 'vitest';
import {
  advanceGameDays,
  clubDayRoutine,
  createWorld,
  GAME_DAY_MS,
  realTimeGameDate,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
const at = (day: number) => Date.UTC(2026, 0, day, 12);
function world() {
  const state = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Dias',
      mode: 'multiplayer',
      now: at(11),
    }),
  );
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const away = state.clubs.ids.find((id) => id !== club.id)!;
  state.fixtures = [10, 16].map((day) => ({
    id: `day-${day}`,
    competitionId: 'serie-a',
    round: day,
    homeId: club.id,
    awayId: away,
    scheduledAt: at(day),
  }));
  state.cups = [];
  state.competitionDraws = [];
  state.roundCalendarVersion = 1;
  state.roundDates = Object.fromEntries(
    state.fixtures.map((f) => ['serie-a:league:' + f.round, f.scheduledAt]),
  );
  state.lastProcessedAt = at(11);
  const player = state.players.byId[club.playerIds[0]!]!;
  state.players = {
    ...state.players,
    byId: { ...state.players.byId, [player.id]: { ...player, fitness: 20 } },
  };
  return { state, club, player };
}
describe('dias da temporada', () => {
  it('treina no dia de sorteio com a carga e o plano individual selecionados, uma única vez', () => {
    const { state, club, player } = world();
    state.competitionDraws = [
      {
        id: 'draw-training',
        competitionId: 'copa-brasil',
        scheduledAt: at(11),
        participantIds: [club.id],
        kind: 'knockout',
        seed: 1,
        completedAt: at(11),
      },
    ];
    const center = state.centers.byId[club.trainingCenterId]!;
    state.centers = {
      ...state.centers,
      byId: {
        ...state.centers.byId,
        [center.id]: {
          ...center,
          operations: {
            load: 'intense',
            fitness: [],
            medical: [],
            syringe: false,
            individual: [{ playerId: player.id, startedAt: at(11), endsAt: at(20) }],
          },
        },
      },
    };
    const trained = advanceGameDays(state, at(12));
    expect(trained.development[player.id]).toBeCloseTo(
      (state.development[player.id] ?? 0) + 0.006 * center.levels.coaching * 1.5 * 1.5,
    );
    expect(advanceGameDays(trained, at(12))).toBe(trained);
  });
  it('usa a mesma programação para o calendário e a simulação', () => {
    const { state, club } = world();
    expect(
      [10, 11, 12, 13, 14, 15, 16].map((day) => clubDayRoutine(state.fixtures, club.id, at(day))),
    ).toEqual(['match', 'recovery', 'rest', 'training', 'training', 'eve', 'match']);
  });
  it('recupera mais na folga, treina conforme a carga e não repete dias', () => {
    const { state, club, player } = world();
    const recovery = advanceGameDays(state, at(12));
    expect(recovery.development[player.id] ?? 0).toBe(state.development[player.id] ?? 0);
    const rest = advanceGameDays(recovery, at(13));
    const rested =
      rest.players.byId[player.id]!.fitness - recovery.players.byId[player.id]!.fitness;
    const trained = advanceGameDays(rest, at(14));
    expect(trained.development[player.id]).toBeGreaterThan(rest.development[player.id] ?? 0);
    expect(rested).toBeGreaterThan(
      trained.players.byId[player.id]!.fitness - rest.players.byId[player.id]!.fitness,
    );
    expect(advanceGameDays(trained, at(14))).toBe(trained);
    const center = state.centers.byId[club.trainingCenterId]!;
    const intense = {
      ...rest,
      centers: {
        ...rest.centers,
        byId: {
          ...rest.centers.byId,
          [center.id]: {
            ...center,
            operations: {
              load: 'intense' as const,
              fitness: [],
              medical: [],
              individual: [],
              syringe: false,
            },
          },
        },
      },
    };
    expect(advanceGameDays(intense, at(14)).development[player.id]).toBeGreaterThan(
      trained.development[player.id]!,
    );
  });
  it('antecipar vários dias aplica os mesmos efeitos de avançar dia a dia', () => {
    const { state } = world();
    let daily = state;
    for (let day = 12; day <= 16; day++) daily = advanceGameDays(daily, at(day));
    expect(advanceGameDays(state, at(16))).toEqual(daily);
  });
  it('aproxima a data do jogo conforme chega o horário real sem ultrapassá-lo', () => {
    const { state } = world();
    const start = Date.parse('2026-10-28T07:00:00-03:00');
    state.calendarAnchor = { realAt: start, gameAt: at(11) };
    state.nextScheduledAt = start + 3600000;
    expect(realTimeGameDate(state, at(16), start + 1800000)).toBe(at(11) + 2.5 * GAME_DAY_MS);
    expect(realTimeGameDate(state, at(16), start + 7200000)).toBe(at(16));
  });
});
