import { domainError } from '../core/domain-error.js';
import { failure, success, type Result } from '../core/result.js';

export type Pairing = Readonly<{ round: number; homeId: string; awayId: string }>;

export function roundRobin(ids: readonly string[], legs: 1 | 2 = 2): Result<readonly Pairing[]> {
  if (ids.length < 2 || new Set(ids).size !== ids.length) {
    return failure(domainError('VALIDATION_ERROR', 'São necessários clubes únicos'));
  }
  const rotating: Array<string | null> = [...ids];
  // Keep the bye fixed so odd-sized leagues also have balanced home/away turns.
  if (rotating.length % 2) rotating.unshift(null);
  const rounds = rotating.length - 1;
  const pairings: Pairing[] = [];
  for (let round = 0; round < rounds; round++) {
    for (let index = 0; index < rotating.length / 2; index++) {
      const left = rotating[index];
      const right = rotating[rotating.length - 1 - index];
      if (!left || !right) continue;
      // Only the fixed pairing changes orientation each round. Alternating every
      // pairing by round makes rotating clubs repeatedly receive the same venue.
      const swap = index === 0 ? round % 2 === 1 : index % 2 === 1;
      // Start at the fourth circle round to avoid a three-game venue streak at
      // the transition to the mirrored return leg in leagues of six or more.
      const scheduledRound =
        ids.length % 2 === 0 && ids.length >= 6 ? (round + rounds - 3) % rounds : round;
      pairings.push(
        Object.freeze({
          round: scheduledRound,
          homeId: swap ? right : left,
          awayId: swap ? left : right,
        }),
      );
    }
    const last = rotating.pop();
    if (last !== undefined) rotating.splice(1, 0, last);
  }
  pairings.sort((a, b) => a.round - b.round);
  if (legs === 2) {
    pairings.push(
      ...pairings.map((match) =>
        Object.freeze({ round: match.round + rounds, homeId: match.awayId, awayId: match.homeId }),
      ),
    );
  }
  return success(Object.freeze(pairings));
}
