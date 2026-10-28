import type { MatchResult } from '@football/shared';
import { visibleActionMinute } from '../../three/match-playback';

export function liveMatchStatistics(result: MatchResult, minute: number) {
  const empty = () => ({
    possession: 50,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    passes: 0,
    corners: 0,
    fouls: 0,
  });
  const statistics = { home: empty(), away: empty() };
  const actions = result.actions ?? [];
  const possession = { home: 0, away: 0 };
  let owner: 'home' | 'away' | undefined;
  let previous = 0;
  const controlsBall = new Set([
    'kickoff',
    'pass',
    'cross',
    'dribble',
    'shot',
    'save',
    'interception',
    'tackle',
    'goal-kick',
    'free-kick',
    'corner',
    'penalty',
  ]);
  for (const [index, action] of actions.entries()) {
    const visibleAt = visibleActionMinute(actions, index);
    if (action.minute > minute || visibleAt > minute) continue;
    const at = Math.max(previous, visibleAt);
    if (owner) possession[owner] += at - previous;
    previous = at;
    if (controlsBall.has(action.type)) owner = action.side;
    const side = statistics[action.side];
    if (action.type === 'pass' || action.type === 'cross') side.passes++;
    if (action.type === 'corner') side.corners++;
    if (action.type === 'foul') side.fouls++;
    if (action.type === 'shot') {
      side.shots++;
      if (action.onTarget ?? ['goal', 'saved'].includes(action.outcome ?? '')) side.shotsOnTarget++;
      side.xg += action.xg ?? 0;
    }
  }
  if (owner) possession[owner] += Math.max(0, Math.min(90, minute) - previous);
  const total = possession.home + possession.away;
  if (total > 0) {
    statistics.home.possession = Math.round((possession.home / total) * 100);
    statistics.away.possession = 100 - statistics.home.possession;
  }
  return minute >= 90 && result.statistics ? result.statistics : statistics;
}

export function visibleRatingActions(result: MatchResult, minute: number) {
  const actions = result.actions ?? [];
  return actions.filter((action, index) => {
    if (action.minute > minute || visibleActionMinute(actions, index) > minute) return false;
    if (action.type === 'shot' && action.outcome === 'goal') {
      const goalIndex = actions.findIndex(
        (event) =>
          event.type === 'goal' &&
          event.minute === action.minute &&
          event.playerId === action.playerId,
      );
      if (goalIndex >= 0 && visibleActionMinute(actions, goalIndex) > minute) return false;
    }
    return true;
  });
}
export function livePlayerRatings(
  result: MatchResult,
  minute: number,
  positions: Readonly<Record<string, { position: string }>>,
) {
  if (minute >= 90 && result.ratings) return result.ratings;
  const ids = [
    ...(result.lineups?.home ?? []),
    ...(result.lineups?.away ?? []),
    ...Object.keys(result.ratings ?? {}),
  ];
  const ratings: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 6]));
  const add = (id: string | undefined, delta: number) => {
    if (id) ratings[id] = (ratings[id] ?? 6) + delta;
  };
  for (const action of visibleRatingActions(result, minute)) {
    const id = action.playerId;
    if (action.type === 'pass') {
      add(id, action.outcome === 'intercepted' ? -0.15 : 0.026);
      if (action.interceptorId) add(action.interceptorId, 0.18);
    }
    if (action.type === 'shot') {
      add(id, action.outcome === 'goal' ? 0.25 : action.onTarget ? 0.18 : -0.16);
      add(
        action.keeperId,
        action.outcome === 'saved' ? 0.35 : action.outcome === 'goal' ? -0.5 : 0,
      );
    }
    if (action.type === 'goal') {
      add(id, 1);
      add(action.assistId, 0.6);
      const defending = action.side === 'home' ? result.lineups?.away : result.lineups?.home;
      for (const defenderId of defending ?? [])
        if (['CB', 'LB', 'RB', 'DM', 'GK'].includes(positions[defenderId]?.position ?? ''))
          add(defenderId, -0.28);
    }
    if (action.type === 'yellow') add(id, -0.4);
    if (action.type === 'red') add(id, -2);
    if (action.type === 'tackle' || action.type === 'interception') add(id, 0.22);
    if (action.type === 'dribble') add(id, 0.07);
    if (action.type === 'cross') add(id, action.outcome === 'complete' ? 0.12 : -0.05);
    if (action.type === 'foul') add(id, -0.15);
  }
  return Object.fromEntries(
    Object.entries(ratings).map(([id, value]) => [
      id,
      Math.round(Math.max(0, Math.min(10, value)) * 10) / 10,
    ]),
  );
}
