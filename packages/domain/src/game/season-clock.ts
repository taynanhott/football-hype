import type { Fixture, WorldState } from '@football/shared';

export const REAL_MATCH_MINUTES = [480, 630, 780, 930, 1080, 1230, 1320, 1410] as const;
const DAY = 86_400_000;
const OFFSET = 3 * 60 * 60_000;

export function nextRealMatchTime(after: number): number {
  const day = Math.floor((after - OFFSET) / DAY) * DAY + OFFSET;
  return (
    REAL_MATCH_MINUTES.map((minute) => day + minute * 60_000).find((at) => at > after) ??
    day + DAY + REAL_MATCH_MINUTES[0] * 60_000
  );
}

/** Whole competition rounds stay together; conflicting competitions use later slots. */
export function scheduledBatches(fixtures: readonly Fixture[]): Fixture[][] {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const key = `${fixture.scheduledAt}:${fixture.competitionId}:${fixture.round}`;
    const group = groups.get(key) ?? [];
    group.push(fixture);
    groups.set(key, group);
  }
  const batches: Fixture[][] = [];
  for (const group of [...groups.values()].sort(
    (a, b) =>
      a[0]!.scheduledAt - b[0]!.scheduledAt ||
      a[0]!.competitionId.localeCompare(b[0]!.competitionId),
  )) {
    // Equal game dates can share a real slot when their clubs do not overlap.
    const previous = batches.at(-1);
    const clubs = new Set(previous?.flatMap((f) => [f.homeId, f.awayId]));
    if (
      previous &&
      previous[0]!.scheduledAt === group[0]!.scheduledAt &&
      group.every((f) => !clubs.has(f.homeId) && !clubs.has(f.awayId))
    )
      previous.push(...group);
    else batches.push([...group]);
  }
  return batches;
}

export function realFixtureTime(
  state: WorldState,
  pending: readonly Fixture[],
  fixture: Fixture,
): number | undefined {
  if (state.mode !== 'multiplayer' || !state.seasonClock) return undefined;
  let at = state.nextScheduledAt;
  for (const batch of scheduledBatches(pending)) {
    if (batch.some((item) => item.id === fixture.id)) return at;
    at = nextRealMatchTime(at);
  }
  return undefined;
}
