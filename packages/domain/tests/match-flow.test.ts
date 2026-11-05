import { describe, expect, it } from 'vitest';
import { FORMATIONS, matchActionSchema } from '@football/shared';
import { simulateMatch, stableId } from '../src/index.js';
import { IDS, playerInput, stadiumInput } from '../../../tests/fixtures/domain.js';

describe('coerência e variedade das jogadas', () => {
  const home = FORMATIONS['4-3-3'].map((slot, i) =>
    playerInput({ id: stableId(101, i), position: slot.position }),
  );
  const away = FORMATIONS['4-3-3'].map((slot, i) =>
    playerInput({ id: stableId(102, i), clubId: IDS.secondClub, position: slot.position }),
  );
  const games = Array.from({ length: 100 }, (_, seed) =>
    simulateMatch(
      {
        id: 'flow',
        competitionId: 'audit',
        round: 0,
        homeId: IDS.club,
        awayId: IDS.secondClub,
        scheduledAt: 0,
      },
      home,
      away,
      stadiumInput(),
      seed,
    ),
  );
  it('atribui o bloqueio a um defensor e mostra o desvio antes do escanteio', () => {
    let checked = 0;
    for (const game of games) {
      const actions = game.actions!;
      for (let i = 0; i < actions.length; i++) {
        const shot = actions[i]!;
        if (shot.type !== 'shot' || shot.outcome !== 'blocked') continue;
        checked++;
        expect(shot.interceptorId).toBeTruthy();
        expect(actions[i + 1]).toMatchObject({
          type: 'interception',
          playerId: shot.interceptorId,
          outcome: 'blocked',
          x: shot.endX,
          z: shot.endZ,
        });
        expect(actions[i + 1]!.side).not.toBe(shot.side);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('conclui as cobranças e mantém todas as ações dentro do relógio da partida', () => {
    for (const game of games) {
      const actions = game.actions!;
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]!;
        expect(matchActionSchema.safeParse(action).success).toBe(true);
        if (i > 0) expect(action.minute).toBeGreaterThanOrEqual(actions[i - 1]!.minute);
        if (action.type === 'free-kick' || action.type === 'penalty') {
          expect(
            actions
              .slice(i + 1)
              .some(
                (next) =>
                  next.side === action.side && ['pass', 'shot', 'cross'].includes(next.type),
              ),
            JSON.stringify({
              seed: game.seed,
              restart: action.type,
              minute: action.minute,
              x: action.x,
              z: action.z,
              tail: actions.slice(-10).map((entry) => [entry.type, entry.side, entry.minute]),
            }),
          ).toBe(true);
        }
      }
    }
  });
  it('mantém o goleiro perto da linha em faltas diretas e pênaltis', () => {
    let checked = 0;
    for (const game of games)
      for (const action of game.actions!) {
        if (
          !['free-kick', 'penalty'].includes(action.type) ||
          (!action.wallIds?.length && action.type !== 'penalty')
        )
          continue;
        const keeperId = action.side === 'home' ? away[0]!.id : home[0]!.id;
        const index = [...home, ...away].findIndex((p) => p.id === keeperId);
        expect(Math.abs(action.coordinates![index * 2 + 1]! / 10)).toBeGreaterThanOrEqual(49);
        checked++;
      }
    expect(checked).toBeGreaterThan(0);
  });
  it('mistura passes rasteiros, enfiadas, lançamentos e cruzamentos sem ciclos constantes', () => {
    const actions = games.flatMap((game) => game.actions!);
    const passes = actions.filter((action) => action.type === 'pass');
    expect(passes.some((action) => action.arc === 0.2)).toBe(true);
    expect(passes.some((action) => action.arc === 0.45)).toBe(true);
    expect(passes.some((action) => (action.arc ?? 0) > 2)).toBe(true);
    expect(actions.some((action) => action.type === 'cross' && action.setPiece !== 'corner')).toBe(
      true,
    );
    let returns = 0;
    for (const game of games)
      for (let i = 1; i < game.actions!.length; i++) {
        const previous = game.actions![i - 1]!,
          action = game.actions![i]!;
        if (
          previous.type === 'pass' &&
          action.type === 'pass' &&
          previous.playerId === action.targetId &&
          previous.targetId === action.playerId
        )
          returns++;
      }
    expect(returns / passes.length).toBeLessThan(0.05);
  });
});
