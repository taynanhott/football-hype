import { describe, expect, it } from 'vitest';
import { runnerMotion } from '../src/three/runner-motion';

describe('movimentos dos jogadores', () => {
  it('alterna as duas pernas e os braços opostos durante a corrida', () => {
    const run = runnerMotion(Math.PI / 2, 1);
    expect(run.leftLeg).toBeGreaterThan(0);
    expect(run.rightLeg).toBeLessThan(0);
    expect(run.leftArm).toBeLessThan(0);
    expect(run.rightArm).toBeGreaterThan(0);
    expect(runnerMotion(0, 0)).toMatchObject({ leftLeg: 0, bounce: 0, lean: 0 });
  });
  it('prepara a perna, finaliza o gesto e dá mais amplitude ao chute', () => {
    expect(runnerMotion(0, 0, { progress: 0.06, shot: false }).rightLeg).toBeGreaterThan(0);
    const pass = runnerMotion(0, 0, { progress: 0.27, shot: false });
    const shot = runnerMotion(0, 0, { progress: 0.27, shot: true });
    expect(pass.rightLeg).toBeLessThan(0);
    expect(shot.rightLeg).toBeLessThan(pass.rightLeg);
    expect(runnerMotion(0, 0, { progress: 0.6, shot: true }).rightLeg).toBeCloseTo(0);
  });
});
