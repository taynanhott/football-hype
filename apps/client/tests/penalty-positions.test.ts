import { describe, expect, it } from 'vitest';
import { penaltyPositions } from '@football/shared';
import { buildPlayback, samplePlayback } from '../src/three/match-playback';

describe('posicionamento nos pênaltis', () => {
  const home = ['taker', 'home-keeper', 'home-defender'];
  const away = ['keeper', 'away-defender'];
  for (const direction of [1, -1]) {
    it(`mantém os demais fora da área durante preparação e chute na direção ${direction}`, () => {
      const frames = buildPlayback(
        [
          {
            minute: 10,
            type: 'penalty',
            side: 'home',
            playerId: 'taker',
            x: 0,
            z: direction * 39,
            setPiece: 'penalty',
            positions: Object.fromEntries(
              [...home, ...away].map((id) => [id, { x: 0, z: direction * 44 }]),
            ),
          },
          {
            minute: 11,
            type: 'shot',
            side: 'home',
            playerId: 'taker',
            keeperId: 'keeper',
            x: 0,
            z: direction * 39,
            endX: 2,
            endZ: direction * 52,
            setPiece: 'penalty',
            outcome: 'goal',
          },
        ],
        home,
        away,
        ['home-keeper', 'keeper'],
      );
      for (const minute of [10, 10.5, 11, 11.4]) {
        const view = samplePlayback(frames, minute);
        for (const id of ['home-keeper', 'home-defender', 'away-defender']) {
          expect(Math.abs(view.positions[id]!.z)).toBeLessThan(33.5);
          expect(
            Math.hypot(view.positions[id]!.x, view.positions[id]!.z - direction * 39),
          ).toBeGreaterThan(9.15);
        }
      }
    });
  }
  it('agrupa os jogadores no meio-campo durante uma disputa, incluindo o goleiro que aguarda', () => {
    const positions = Object.fromEntries([...home, ...away].map((id) => [id, { x: 15, z: 45 }]));
    const arranged = penaltyPositions(positions, 'taker', 'keeper', { x: 0, z: 39 }, true);
    for (const id of ['home-keeper', 'home-defender', 'away-defender'])
      expect(Math.hypot(arranged[id]!.x, arranged[id]!.z)).toBeLessThan(9.15);
    expect(new Set(Object.values(arranged).map((p) => p.z)).size).toBeGreaterThan(3);
    expect(arranged.taker).toEqual({ x: 0, z: 39 });
    expect(arranged.keeper).toEqual({ x: 0, z: 49.5 });
  });
});
