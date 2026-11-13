import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '@football/shared';
import { advanceGameDays, createWorld, playNextBatch } from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const now = Date.parse('2026-01-15T15:00:00Z');
describe('desgaste aplicado ao estado da carreira', () => {
  it('desconta o desgaste da simulação e mantém cansaço até a partida quatro dias depois', () => {
    const state = advanceGameDays(
      unwrap(
        createWorld({
          id: IDS.league,
          userId: IDS.user,
          name: 'Desgaste',
          mode: 'offline',
          now,
        }),
      ),
      now,
    );
    const club = state.clubs.byId[state.participants[0]!.clubId]!;
    const away = state.clubs.ids.find((id) => id !== club.id)!;
    const starters = club.playerIds.slice(0, 11);
    state.players = {
      ...state.players,
      byId: Object.fromEntries(
        Object.entries(state.players.byId).map(([id, p]) => [id, { ...p, age: 30, fitness: 100 }]),
      ),
    };
    const center = state.centers.byId[club.trainingCenterId]!;
    state.centers = {
      ...state.centers,
      byId: {
        ...state.centers.byId,
        [center.id]: { ...center, levels: { ...center.levels, fitness: 3 } },
      },
    };
    state.tactics[club.id] = {
      formation: '4-3-3',
      starters,
      instructions: { protected: starters, substitutions: [], situations: [] },
    };
    state.injuries = {};
    state.cups = [];
    state.competitionDraws = [];
    state.fixtures = [0, 4].map((day, index) => ({
      id: `fatigue-${index}`,
      competitionId: 'serie-a',
      round: index + 1,
      homeId: club.id,
      awayId: away,
      scheduledAt: now + day * 86400000,
    }));
    state.roundCalendarVersion = 1;
    state.roundDates = Object.fromEntries(
      state.fixtures.map((f) => [`serie-a:league:${f.round}`, f.scheduledAt]),
    );
    const played = unwrap(playNextBatch(state, now));
    const result = played.results.find((r) => r.fixtureId === 'fatigue-0')!;
    const id = starters.find(
      (id) => state.players.byId[id]!.position !== 'GK' && result.minutesPlayed?.[id] === 90,
    )!;
    expect(id).toBeDefined();
    const spent = result.fitnessSpent![id]!;
    expect(GAMEPLAY.fitnessCost).toBe(36);
    expect(spent).toBeGreaterThanOrEqual(33);
    expect(played.players.byId[id]!.fitness).toBe(100 - Math.ceil(spent));
    const restored = JSON.parse(JSON.stringify(played)) as typeof played;
    const recovered = advanceGameDays(restored, played.lastProcessedAt + 4 * 86400000);
    expect(recovered.players.byId[id]!.fitness).toBeGreaterThan(played.players.byId[id]!.fitness);
    expect(recovered.players.byId[id]!.fitness).toBeLessThan(90);
  });
});
