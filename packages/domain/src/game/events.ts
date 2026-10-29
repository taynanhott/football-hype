import {
  gameEventSchema,
  worldStateSchema,
  type GameEvent,
  type WorldState,
} from '@football/shared';
import { recordFinancialHistory } from '../finance/financial-management.js';
import { parseBoundary } from '../core/validation.js';
import { mapResult, type Result } from '../core/result.js';

export function recordEvent(
  previous: WorldState,
  next: WorldState,
  metadata: Omit<GameEvent, 'sequence' | 'patch'>,
): Result<GameEvent> {
  next = recordFinancialHistory(previous, next);
  // Unchanged branches already passed validation when the world was loaded.
  // Validate the event's changed branches instead of cloning the entire world.
  return parseBoundary(gameEventSchema, {
    ...metadata,
    gameOccurredAt: next.lastProcessedAt,
    balances: Object.fromEntries(
      next.clubs.ids
        .map((id) => [
          id,
          (next.clubs.byId[id]?.balance.cents ?? 0) - (previous.clubs.byId[id]?.balance.cents ?? 0),
        ])
        .filter(([, amount]) => amount !== 0),
    ),
    sequence: previous.revision + 1,
    patch: {
      ...Object.fromEntries(
        Object.entries(next).filter(
          ([key]) =>
            key !== 'revision' &&
            previous[key as keyof WorldState] !== next[key as keyof WorldState],
        ),
      ),
      revision: previous.revision + 1,
    },
  });
}
export function applyEvent(state: WorldState, event: GameEvent): Result<WorldState> {
  if (event.sequence !== state.revision + 1) return parseBoundary(worldStateSchema, null);
  return mapResult(parseBoundary(gameEventSchema, event), (validated) =>
    Object.assign({}, state, validated.patch, { revision: validated.sequence }),
  );
}
