import type { WorldState } from '@football/shared';
import { cupFinal } from './qualification.js';
import { nextPlayingTime } from './calendar.js';

export function applyPreLibertadores(state: WorldState): WorldState {
  let fixtures = state.fixtures;
  for (const node of state.cups.filter(
    (node) => node.competitionId === 'pre-libertadores' && node.winnerId && node.homeId,
  )) {
    if (node.winnerId === node.homeId) continue;
    fixtures = fixtures.map((f) =>
      f.competitionId === 'libertadores'
        ? {
            ...f,
            homeId: f.homeId === node.homeId ? node.winnerId! : f.homeId,
            awayId: f.awayId === node.homeId ? node.winnerId! : f.awayId,
          }
        : f,
    );
  }
  return fixtures === state.fixtures ? state : { ...state, fixtures };
}
export function scheduleIntercontinental(state: WorldState): WorldState {
  if (state.cups.some((node) => node.competitionId === 'intercontinental')) return state;
  const homeId = cupFinal(state, 'libertadores')?.winnerId;
  const awayId = cupFinal(state, 'europa')?.winnerId;
  if (!homeId || !awayId) return state;
  const stadium = state.stadiums.ids.find(
    (id) =>
      id !== state.clubs.byId[homeId]?.stadiumId && id !== state.clubs.byId[awayId]?.stadiumId,
  );
  if (!stadium) return state;
  return {
    ...state,
    cups: [
      ...state.cups,
      {
        id: 'intercontinental:final',
        competitionId: 'intercontinental',
        round: 0,
        homeId,
        awayId,
        leftId: null,
        rightId: null,
        winnerId: null,
        scheduledAt: nextPlayingTime(state.lastProcessedAt + 60000),
        legs: 1,
        neutral: true,
        stadiumId: stadium,
        label: 'Final · campo neutro',
      },
    ],
  };
}
export function penaltyShootout(random: () => number) {
  let home = 0,
    away = 0;
  for (let i = 0; i < 5; i++) {
    if (random() < 0.75) home++;
    if (home > away + 5 - i) return { home, away };
    if (random() < 0.75) away++;
    if (home > away + 4 - i || away > home + 4 - i) return { home, away };
  }
  for (let i = 0; home === away && i < 50; i++) {
    if (random() < 0.75) home++;
    if (random() < 0.75) away++;
  }
  if (home === away) {
    if (random() < 0.5) home++;
    else away++;
  }
  return { home, away };
}
