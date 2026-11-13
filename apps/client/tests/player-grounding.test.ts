import { describe, expect, it } from 'vitest';
import { Matrix4, Quaternion, Vector3, Euler } from 'three';
import { bootGroundLift, PITCH_SURFACE_Y } from '../src/three/pitch-surface';
import { playerBuild } from '../src/three/player-build';

describe('apoio das chuteiras no gramado', () => {
  it('apoia jogadores de diferentes alturas na superfície elevada do campo', () => {
    for (let i = 0; i < 30; i++) {
      const scale = 0.7 * playerBuild(String(i)).height;
      const boot = new Matrix4().compose(
        new Vector3(0, PITCH_SURFACE_Y + 0.1 * scale, 0),
        new Quaternion(),
        new Vector3(0.12 * scale, 0.1 * scale, 0.225 * scale),
      );
      expect(bootGroundLift(boot)).toBeCloseTo(0);
    }
  });

  it('compensa a ponta da chuteira inclinada que atravessaria o gramado', () => {
    const boot = new Matrix4().compose(
      new Vector3(0, PITCH_SURFACE_Y + 0.07, 0),
      new Quaternion().setFromEuler(new Euler(0.7, 0, 0)),
      new Vector3(0.084, 0.07, 0.1575),
    );
    const lift = bootGroundLift(boot);
    expect(lift).toBeGreaterThan(0.04);
    boot.elements[13]! += lift;
    expect(bootGroundLift(boot)).toBeCloseTo(0);
  });

  it('não puxa um jogador no ar para baixo', () => {
    const boot = new Matrix4().makeScale(0.084, 0.07, 0.1575);
    boot.setPosition(0, 0.8, 0);
    expect(bootGroundLift(boot)).toBe(0);
  });
});
