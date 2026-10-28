import type { CupNode } from '@football/shared';
import { domainError } from '../core/domain-error.js';
import { failure, success, type Result } from '../core/result.js';

export function buildBracket(
  ids: readonly string[],
  competitionId: string,
  dates: readonly number[],
): Result<readonly CupNode[]> {
  if (ids.length < 2 || (ids.length & (ids.length - 1)) !== 0 || new Set(ids).size !== ids.length) {
    return failure(
      domainError('VALIDATION_ERROR', 'Mata-mata exige potência de dois e clubes únicos'),
    );
  }
  const nodes: CupNode[] = [];
  let previous: CupNode[] = [];
  for (let round = 0, count = ids.length / 2; count >= 1; round++, count /= 2) {
    const current: CupNode[] = [];
    const scheduledAt = dates[round];
    if (scheduledAt === undefined)
      return failure(domainError('VALIDATION_ERROR', 'Calendário insuficiente'));
    for (let index = 0; index < count; index++) {
      current.push({
        id: `${competitionId}:${round}:${index}`,
        competitionId,
        round,
        scheduledAt,
        homeId: round === 0 ? (ids[index * 2] ?? null) : null,
        awayId: round === 0 ? (ids[index * 2 + 1] ?? null) : null,
        leftId: previous[index * 2]?.id ?? null,
        rightId: previous[index * 2 + 1]?.id ?? null,
        winnerId: null,
      });
    }
    nodes.push(...current);
    previous = current;
  }
  return success(Object.freeze(nodes.map((node) => Object.freeze(node))));
}

export function advanceBracket(
  nodes: readonly CupNode[],
  matchId: string,
  winnerId: string,
): Result<readonly CupNode[]> {
  const match = nodes.find((node) => node.id === matchId);
  if (!match || match.winnerId || (match.homeId !== winnerId && match.awayId !== winnerId)) {
    return failure(domainError('VALIDATION_ERROR', 'Vencedor ou confronto inválido'));
  }
  const updated = nodes.map((node) => ({
    ...node,
    winnerId: node.id === matchId ? winnerId : node.winnerId,
    homeId: node.leftId === matchId ? winnerId : node.homeId,
    awayId: node.rightId === matchId ? winnerId : node.awayId,
  }));
  return success(Object.freeze(updated.map((node) => Object.freeze(node))));
}
