import type { GameCommand, GameEvent, WorldState } from '@football/shared';
import { domainError } from '../core/domain-error.js';
import { failure, type Result } from '../core/result.js';
import { recordEvent } from './events.js';
import { handleCommand } from './command-handlers.js';
export function executeCommand(
  state: WorldState,
  command: GameCommand,
  userId: string,
  now: number,
  eventId: string,
): Result<GameEvent> {
  const participant = state.participants.find((member) => member.userId === userId);
  if (!participant)
    return failure(domainError('VALIDATION_ERROR', 'Você não participa desta liga'));
  const club = state.clubs.byId[participant.clubId];
  if (!club) return failure(domainError('ENTITY_NOT_FOUND', 'Clube não encontrado'));
  const result = handleCommand({ state, club, command, userId, now, eventId });
  if (!result.ok) return result;
  const { next, type, message, amount } = result.value;
  return recordEvent(state, next, {
    id: eventId,
    occurredAt: now,
    actorId: userId,
    type,
    message,
    amount,
  });
}
