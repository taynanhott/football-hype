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
  type Fixture,
} from '@football/shared';
import { effectiveOverall } from './management.js';
import { isFifaWindow } from '../competitions/calendar.js';
import { scheduledFixtures } from '../competitions/fixtures.js';

const POSITION_PATHS: Partial<Record<Position, readonly Position[]>> = {
  GK: ['GK'],
  CB: ['CB', 'DM', 'LB', 'RB'],
  LB: ['LB', 'RB', 'LWB', 'LM', 'LW'],
  RB: ['RB', 'LB', 'RWB', 'RM', 'RW'],
  LWB: ['LWB', 'LB', 'LM', 'LW'],
  RWB: ['RWB', 'RB', 'RM', 'RW'],
  LW: ['LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'LWB', 'RWB', 'ST', 'SS'],
  RW: ['RW', 'LW', 'RM', 'LM', 'RB', 'LB', 'RWB', 'LWB', 'ST', 'SS'],
  ST: ['ST', 'SS', 'LW', 'RW'],
  SS: ['SS', 'ST', 'LW', 'RW', 'AM'],
  CM: ['CM', 'DM', 'AM', 'LM', 'RM', 'LW', 'RW'],
  DM: ['DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW'],
  AM: ['AM', 'CM', 'DM', 'LM', 'RM', 'LW', 'RW'],
  LM: ['LM', 'RM', 'CM', 'DM', 'AM', 'LW', 'RW'],
  RM: ['RM', 'LM', 'CM', 'DM', 'AM', 'LW', 'RW'],
};
export function canLearnPosition(natural: Position, assigned: Position) {
  return POSITION_PATHS[natural]?.includes(assigned) ?? natural === assigned;
}
// Lateral distance distinguishes opposite flanks; depth follows the lines of play.
const POSITION_LOCATION: Record<Position, readonly [number, number]> = {
  GK: [0, -1],
  CB: [0, 0],
  LB: [-2, 0],
  RB: [2, 0],
  LWB: [-2, 1],
  RWB: [2, 1],
  DM: [0, 1],
  CM: [0, 2],
  LM: [-2, 2],
  RM: [2, 2],
  AM: [0, 3],
  LW: [-2, 3],
  RW: [2, 3],
  SS: [0, 3.5],
  ST: [0, 4],
};
export function positionFactor(natural: Position, assigned: Position, matches = 0): number {
  if (natural === assigned) return 1;
  if (natural === 'GK' || assigned === 'GK') return TACTICS.goalkeeperMismatchFactor;
  const origin = POSITION_LOCATION[natural];
  const target = POSITION_LOCATION[assigned];
  const distance = Math.hypot(origin[0] - target[0], origin[1] - target[1]);
  const learnable = canLearnPosition(natural, assigned);
  const base = distance <= 1 ? 0.97 : distance <= 2.5 ? 0.94 : learnable ? 0.85 : 0.45;
  if (!learnable) return base;
  return base + ((1 - base) * Math.min(15, Math.max(0, matches))) / 15;
}
export function masteredPositions(
  state: Pick<WorldState, 'positionExperience'>,
  player: PlayerSnapshot,
): Position[] {
  const extra = Object.entries(state.positionExperience?.[player.id] ?? {}).find(
    ([pos, matches]) =>
      pos !== player.position &&
      matches >= 15 &&
      canLearnPosition(player.position, pos as Position),
  );
  return extra ? [player.position, extra[0] as Position] : [player.position];
}
export function learnedPositionFactor(
  state: WorldState,
  player: PlayerSnapshot,
  assigned: Position,
) {
  return positionFactor(
    player.position,
    assigned,
    state.positionExperience?.[player.id]?.[assigned] ?? 0,
  );
}
export function startingAverage(state: WorldState, club: ClubSnapshot, at = state.lastProcessedAt) {
  const entries = resolveLineup(state, club, at);
  return Math.min(
    99,
    entries.reduce((sum, entry) => sum + (entry.player ? entry.effectiveOverall : 0), 0) / 11 +
      lineupTacticalBonus(entries),
  );
}
export function lineupTacticalBonus(
  entries: readonly { player?: PlayerSnapshot | undefined; chemistry: number }[],
) {
  const selected = entries.filter((e) => e.player);
  if (!selected.length) return 0;
  const chemistry = selected.reduce((sum, e) => sum + e.chemistry, 0) / 11;
  return 1 + (2 * Math.min(100, Math.max(0, chemistry))) / 100;
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
const nextFixtures = new WeakMap<WorldState, Map<string, Fixture>>();
export function nextClubFixture(state: WorldState, clubId: string): Fixture | undefined {
  let fixtures = nextFixtures.get(state);
  if (!fixtures) {
    fixtures = new Map();
    const completed = new Set(state.results.map((result) => result.fixtureId));
    for (const fixture of scheduledFixtures(state)) {
      if (completed.has(fixture.id)) continue;
      for (const id of [fixture.homeId, fixture.awayId])
        if (!fixtures.has(id)) fixtures.set(id, fixture);
    }
    nextFixtures.set(state, fixtures);
  }
  return fixtures.get(clubId);
}
/** The editor uses the current game date; matches revalidate at their actual fixture date. */
export function clubAvailabilityAt(state: WorldState, _club: ClubSnapshot): number {
  void _club;
  return state.lastProcessedAt;
}
export function playerSuspension(
  state: WorldState,
  playerId: string,
  competitionId?: string,
): number {
  if (!state.discipline) return 0;
  const clubId = state.players.byId[playerId]?.clubId;
  const competition =
    competitionId ?? (clubId ? nextClubFixture(state, clubId)?.competitionId : undefined);
  return competition
    ? (state.discipline?.competitions[competition]?.[playerId]?.suspendedGames ?? 0)
    : 0;
}
export function playerAvailable(
  state: WorldState,
  playerId: string,
  at: number,
  competitionId?: string,
): boolean {
  const player = state.players.byId[playerId];
  return (
    Boolean(player) &&
    medicallyAvailable(state, playerId) &&
    !playerSuspension(state, playerId, competitionId) &&
    !(isFifaWindow(at) && player!.overall >= 80)
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
  competitionId?: string,
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
        Boolean(player) && playerAvailable(state, player?.id ?? '', at, competitionId),
    );
  const used = new Set<string>();
  const retainedStarters = new Set(
    available.filter((player) => desired.includes(player.id)).map((player) => player.id),
  );
  return FORMATIONS[shape].map((slot, index) => {
    const requested = available.find(
      (player) => player.id === desired[index] && !used.has(player.id),
    );
    const player =
      requested ??
      available
        .filter((candidate) => !used.has(candidate.id) && !retainedStarters.has(candidate.id))
        .sort((a, b) => {
          if (desired[index]) {
            const samePosition =
              Number(b.position === slot.position) - Number(a.position === slot.position);
            if (samePosition) return samePosition;
            if (a.position === slot.position) return b.overall - a.overall || b.fitness - a.fitness;
          }
          return (
            b.overall * learnedPositionFactor(state, b, slot.position) * (0.5 + b.fitness / 200) -
            a.overall * learnedPositionFactor(state, a, slot.position) * (0.5 + a.fitness / 200)
          );
        })[0];
    if (!player)
      return { ...slot, player: undefined, chemistry: 0, factor: 1, effectiveOverall: 0 };
    used.add(player.id);
    const chemistry = Math.min(
      chemistryPercent(state.chemistry[club.id]?.[player.id] ?? 0),
      adaptation.formation,
      adaptation.style,
    );
    const factor = learnedPositionFactor(state, player, slot.position);
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
  competitionId?: string,
) {
  const available = club.playerIds
    .map((id) => state.players.byId[id])
    .filter(
      (player): player is PlayerSnapshot =>
        Boolean(player) &&
        !starters.includes(player!.id) &&
        playerAvailable(state, player!.id, at, competitionId),
    );
  const requested = preferred ?? state.tactics[club.id]?.bench;
  if (requested?.length) {
    const selected = new Set(
      requested.filter((id) => available.some((player) => player.id === id)).slice(0, 12),
    );
    return requested
      .slice(0, 12)
      .flatMap((id) => {
        if (available.some((player) => player.id === id)) return [id];
        if (starters.includes(id) && !state.tactics[club.id]?.bench?.includes(id)) return [];
        if (!club.playerIds.includes(id)) return [];
        const position = state.players.byId[id]?.position;
        const replacement = available
          .filter((player) => !selected.has(player.id))
          .sort(
            (a, b) =>
              Number(b.position === position) - Number(a.position === position) ||
              b.overall - a.overall,
          )[0];
        if (!replacement) return [];
        selected.add(replacement.id);
        return [replacement.id];
      })
      .filter((id, index, ids) => ids.indexOf(id) === index);
  }
  return available
    .sort(
      (a, b) =>
        Number(b.position === 'GK') - Number(a.position === 'GK') ||
        effectiveOverall(state, b) - effectiveOverall(state, a),
    )
    .slice(0, 12)
    .map((player) => player.id);
}

/** Every squad starts each season at 50% integration. */
export function initializeStartingChemistry(state: WorldState): WorldState {
  const chemistry = Object.fromEntries(
    Object.values(state.clubs.byId).map((club) => [
      club.id,
      Object.fromEntries(
        club.playerIds
          .filter((id) => !!state.players.byId[id])
          .map((id) => [id, TACTICS.chemistryMatches / 2]),
      ),
    ]),
  );
  return { ...state, chemistry };
}
