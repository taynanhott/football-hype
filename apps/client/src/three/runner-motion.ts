export function runnerMotion(
  stride: number,
  running: number,
  kick?: { progress: number; shot: boolean },
) {
  const swing = Math.sin(stride) * 0.7 * running;
  let rightLeg = -swing;
  let brace = 0;
  if (kick && kick.progress < 0.42) {
    const t = Math.max(0, kick.progress);
    rightLeg =
      t < 0.12
        ? Math.sin((t / 0.12) * Math.PI) * 0.65
        : -Math.sin(Math.min(1, (t - 0.12) / 0.3) * Math.PI) * (kick.shot ? 1.55 : 1.0);
    brace = Math.sin(Math.min(1, t / 0.42) * Math.PI);
  }
  return {
    leftLeg: swing * (brace ? 0.25 : 1),
    rightLeg,
    leftKnee: Math.max(0, -Math.sin(stride)) * running * 0.85,
    rightKnee: brace ? Math.max(0, rightLeg) * 0.6 : Math.max(0, Math.sin(stride)) * running * 0.85,
    leftArm: -swing * 0.8 - brace * 0.3,
    rightArm: swing * 0.8 + brace * 0.4,
    lean: running * 0.08 + brace * 0.12,
    bounce: Math.abs(Math.sin(stride)) * running * 0.07,
  };
}
