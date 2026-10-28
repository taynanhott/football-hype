import {
  FORMATIONS,
  TACTICS,
  GAMEPLAY,
  type ClubSnapshot,
  type Formation,
  type PlayerSnapshot,
  type Position,
  type PlayStyle,
  type WorldState,
} from '@football/shared';
import { effectiveOverall } from './management.js';
import { isFifaWindow } from '../competitions/calendar.js';

const RELATED = [
  ['CB', 'DM'],
  ['LB', 'RB'],
  ['LB', 'LM', 'LW'],
  ['RB', 'RM', 'RW'],
  ['CM', 'DM', 'AM'],
  ['LM', 'LW'],
  ['RM', 'RW'],
  ['LW', 'RW', 'ST'],
];
export function positionFactor(natural: Position, assigned: Position): number {
  if (natural === assigned) return 1;
  if (natural === 'GK' || assigned === 'GK') return TACTICS.goalkeeperMismatchFactor;
  return RELATED.some((group) => group.includes(natural) && group.includes(assigned))
    ? TACTICS.relatedPositionFactor
    : TACTICS.wrongPositionFactor;
}
export function chemistryPercent(matches: number): number {
  return Math.min(100, (Math.max(0, matches) / TACTICS.chemistryMatches) * 100);
}
export function injuryProbability(
  fitness: number,
  consecutive: number,
  restHours: number,
  medical: number,
): number {
  const fatigue = (100 - Math.min(100, Math.max(0, fitness))) / 100;
  return Math.min(
    TACTICS.maximumInjuryChance,
    (GAMEPLAY.injuryChance +
      fatigue ** 2 * TACTICS.fatigueInjuryScale +
      Math.max(0, consecutive - 2) * TACTICS.consecutiveInjuryScale +
      Math.max(0, 1 - restHours / TACTICS.safeRestHours) * TACTICS.shortRestInjuryScale) /
      Math.sqrt(Math.max(1, medical)),
  );
}
/** A medical clearance preserves the injury while allowing the next club fixture. */
export function medicallyAvailable(state: WorldState, playerId: string): boolean {
  if (!(state.injuries[playerId] ?? 0)) return true;
  const club = state.clubs.byId[state.players.byId[playerId]?.clubId ?? ''];
  return (
    !!club &&
    state.centers.byId[club.trainingCenterId]?.operations?.clearance?.playerId === playerId
  );
}
const adaptationCache = new WeakMap<
  WorldState,
  Map<string, Array<{ formation: Formation; style: PlayStyle }>>
>();
export function tacticalAdaptation(
  state: WorldState,
  clubId: string,
  formation: Formation,
  style: PlayStyle,
) {
  let clubs = adaptationCache.get(state);
  if (!clubs) {
    clubs = new Map();
    adaptationCache.set(state, clubs);
  }
  let history = clubs.get(clubId);
  if (!history) {
    history = [...(state.seasonArchives ?? []), state]
      .flatMap((season) => {
        const fixtures = new Map(season.fixtures.map((fixture) => [fixture.id, fixture]));
        return season.results.flatMap((result) => {
          const fixture = fixtures.get(result.fixtureId);
          if (!fixture || (fixture.homeId !== clubId && fixture.awayId !== clubId)) return [];
          const plan = result.tacticalPlans?.[fixture.homeId === clubId ? 'home' : 'away'];
          return plan
            ? [
                {
                  formation: plan.formation,
                  style: plan.style ?? ('balanced' as PlayStyle),
                  at: fixture.scheduledAt,
                },
              ]
            : [];
        });
      })
      .sort((a, b) => a.at - b.at);
    clubs.set(clubId, history);
  }
  const matches = history.filter(
    (plan) => plan.formation === formation && plan.style === style,
  ).length;
  // The original system is already established when a league starts.
  const mastered = matches >= 6 || (formation === '4-3-3' && style === 'balanced');
  const streak = (matchesPlan: (plan: { formation: Formation; style: PlayStyle }) => boolean) => {
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (!matchesPlan(history[i]!)) break;
      count++;
    }
    return Math.min(100, (count / 3) * 100);
  };
  return {
    formation: mastered ? 100 : streak((plan) => plan.formation === formation),
    style: mastered ? 100 : streak((plan) => plan.style === style),
    mastered,
    matches,
  };
}

export function resolveLineup(
  state: WorldState,
  club: ClubSnapshot,
  at: number,
  pool = state.players.byId,
  formation?: Formation,
  preferred?: readonly string[],
  playStyle?: PlayStyle,
) {
  const saved = state.tactics[club.id];
  const shape = formation ?? saved?.formation ?? '4-3-3';
  const desired = preferred ?? saved?.starters ?? [];
  const adaptation = tacticalAdaptation(
    state,
    club.id,
    shape,
    playStyle ?? saved?.style ?? 'balanced',
  );
  const available = club.playerIds
    .map((id) => pool[id])
    .filter(
      (player): player is PlayerSnapshot =>
        Boolean(player) &&
        medicallyAvailable(state, player?.id ?? '') &&
        !(isFifaWindow(at) && (player?.overall ?? 0) >= 80),
    );
  const used = new Set<string>();
  return FORMATIONS[shape].map((slot, index) => {
    const requested = available.find(
      (player) => player.id === desired[index] && !used.has(player.id),
    );
    const player =
      requested ??
      available
        .filter((candidate) => !used.has(candidate.id))
        .sort(
          (a, b) =>
            b.overall * positionFactor(b.position, slot.position) * (0.5 + b.fitness / 200) -
            a.overall * positionFactor(a.position, slot.position) * (0.5 + a.fitness / 200),
        )[0];
    if (!player)
      return { ...slot, player: undefined, chemistry: 0, factor: 1, effectiveOverall: 0 };
    used.add(player.id);
    const chemistry = Math.min(
      chemistryPercent(state.chemistry[club.id]?.[player.id] ?? 0),
      adaptation.formation,
      adaptation.style,
    );
    const factor = positionFactor(player.position, slot.position);
    return {
      ...slot,
      player,
      chemistry,
      factor,
      effectiveOverall: Math.max(
        1,
        Math.floor(
          effectiveOverall(state, player) *
            factor *
            (TACTICS.chemistryBase + ((1 - TACTICS.chemistryBase) * chemistry) / 100),
        ),
      ),
    };
  });
}

export function resolveBench(
  state: WorldState,
  club: ClubSnapshot,
  at: number,
  starters: readonly string[],
  preferred?: readonly string[],
) {
  const available = club.playerIds
    .map((id) => state.players.byId[id])
    .filter(
      (player): player is PlayerSnapshot =>
        Boolean(player) &&
        !starters.includes(player!.id) &&
        medicallyAvailable(state, player!.id) &&
        !(isFifaWindow(at) && player!.overall >= 80),
    );
  const requested = preferred ?? state.tactics[club.id]?.bench;
  if (requested?.length)
    return requested.filter((id) => available.some((player) => player.id === id)).slice(0, 12);
  return available
    .sort(
      (a, b) =>
        Number(b.position === 'GK') - Number(a.position === 'GK') ||
        effectiveOverall(state, b) - effectiveOverall(state, a),
    )
    .slice(0, 12)
    .map((player) => player.id);
}

/** Established starting elevens begin a new league fully integrated. */
export function initializeStartingChemistry(state: WorldState): WorldState {
  const chemistry = Object.fromEntries(
    Object.values(state.clubs.byId).map((club) => [
      club.id,
      Object.fromEntries(
        resolveLineup(state, club, state.createdAt).flatMap((slot) =>
          slot.player ? [[slot.player.id, TACTICS.chemistryMatches]] : [],
        ),
      ),
    ]),
  );
  return { ...state, chemistry };
}
