import type { WorldState } from '@football/shared';

type CardStats = {
  games: number;
  goals: number;
  assists: number;
  minutes: number;
  yellow: number;
  average: number | null;
  form: number | null;
};
const cache = new WeakMap<WorldState, Map<string, CardStats>>();
export function playerCardStats(world: WorldState, playerId: string): CardStats {
  let index = cache.get(world);
  if (!index) {
    index = new Map();
    const entry = (id: string) => {
      let stats = index!.get(id);
      if (!stats) {
        stats = {
          games: 0,
          goals: 0,
          assists: 0,
          minutes: 0,
          yellow: 0,
          average: null,
          form: null,
        };
        index!.set(id, stats);
      }
      return stats;
    };
    for (const result of world.results) {
      const starters = new Set([...(result.lineups?.home ?? []), ...(result.lineups?.away ?? [])]);
      const participants = new Set(starters);
      for (const sub of result.substitutions ?? []) participants.add(sub.in);
      for (const [id, minutes] of Object.entries(result.minutesPlayed ?? {}))
        if (minutes > 0) participants.add(id);
      for (const id of Object.keys(result.ratings ?? {})) participants.add(id);
      for (const goal of result.scorers) {
        entry(goal.playerId).goals++;
        if (goal.assistId) entry(goal.assistId).assists++;
      }
      for (const action of result.actions ?? [])
        if (action.type === 'yellow' && action.playerId) entry(action.playerId).yellow++;
      for (const id of participants) {
        const stats = entry(id);
        stats.games++;
        const entered = starters.has(id)
          ? 0
          : result.substitutions?.find((sub) => sub.in === id)?.minute;
        const left = result.substitutions?.find((sub) => sub.out === id)?.minute ?? 90;
        stats.minutes +=
          result.minutesPlayed?.[id] ?? (entered === undefined ? 0 : Math.max(0, left - entered));
      }
    }
    const ratings = new Map<string, number[]>();
    for (const row of world.ratingHistory) {
      if (row.season !== world.season) continue;
      const values = ratings.get(row.playerId) ?? [];
      values.push(row.rating);
      ratings.set(row.playerId, values);
    }
    for (const [id, values] of ratings) {
      const stats = entry(id);
      stats.games = Math.max(stats.games, values.length);
      stats.average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const recent = values.slice(-5);
      stats.form = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    }
    cache.set(world, index);
  }
  return (
    index.get(playerId) ?? {
      games: 0,
      goals: 0,
      assists: 0,
      minutes: 0,
      yellow: 0,
      average: null,
      form: null,
    }
  );
}
