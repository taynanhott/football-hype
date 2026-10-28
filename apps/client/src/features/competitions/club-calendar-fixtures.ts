import { scheduledFixtures } from '@football/domain';
import type { WorldState } from '@football/shared';

export function clubCalendarFixtures(state: WorldState, clubId: string) {
  return scheduledFixtures(state).filter(
    (fixture) => fixture.homeId === clubId || fixture.awayId === clubId,
  );
}
