import { resetTransferredEffects } from './contract-lifecycle.js';
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
  next = resetTransferredEffects(previous, next);
  next = recordFinancialHistory(previous, next);
  let validatedPlayers: WorldState['players'] | undefined;
  if (next.players !== previous.players) {
    // Unchanged frozen entities were validated on load. Validate every changed
    // player, retaining full validation when the collection's index changes.
    const sameIndex =
      next.players.ids === previous.players.ids &&
      Object.keys(next.players).every((key) => key === 'ids' || key === 'byId') &&
      Object.keys(next.players.byId).length === previous.players.ids.length &&
      previous.players.ids.every((id) => Object.hasOwn(next.players.byId, id));
    const changedIds = sameIndex
      ? next.players.ids.filter((id) => next.players.byId[id] !== previous.players.byId[id])
      : next.players.ids;
    const parsed = parseBoundary(
      worldStateSchema.shape.players,
      sameIndex
        ? {
            ids: changedIds,
            byId: Object.fromEntries(changedIds.map((id) => [id, next.players.byId[id]])),
          }
        : next.players,
    );
    if (!parsed.ok) return parsed;
    validatedPlayers = sameIndex
      ? Object.freeze({
          ids: previous.players.ids,
          byId: Object.freeze({ ...previous.players.byId, ...parsed.value.byId }),
        })
      : parsed.value;
  }
  // Unchanged branches already passed validation when the world was loaded.
  // Validate the event's changed branches instead of cloning the entire world.
  const appendedResults =
    next.results !== previous.results &&
    next.results.length >= previous.results.length &&
    previous.results.every((result, index) => next.results[index] === result);
  const recorded = parseBoundary(gameEventSchema, {
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
            key !== 'players' &&
            previous[key as keyof WorldState] !== next[key as keyof WorldState],
        ),
      ),
      revision: previous.revision + 1,
      ...(appendedResults ? { results: next.results.slice(previous.results.length) } : {}),
    },
  });
  return mapResult(recorded, (event) => ({
    ...event,
    patch: {
      ...event.patch,
      ...(validatedPlayers ? { players: validatedPlayers } : {}),
      ...(appendedResults ? { results: [...previous.results, ...event.patch.results!] } : {}),
    },
  }));
}
export function applyEvent(state: WorldState, event: GameEvent): Result<WorldState> {
  if (event.sequence !== state.revision + 1) return parseBoundary(worldStateSchema, null);
  return mapResult(parseBoundary(gameEventSchema, event), (validated) =>
    Object.assign({}, state, validated.patch, { revision: validated.sequence }),
  );
}
