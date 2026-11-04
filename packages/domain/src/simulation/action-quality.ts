import type { PlayerSnapshot } from '@football/shared';
type Skill = 'passing' | 'finishing' | 'defending' | 'dribbling' | 'keeping';
const specialists: Record<Skill, readonly string[]> = {
  passing: ['CM', 'AM', 'DM', 'LM', 'RM'],
  finishing: ['ST', 'LW', 'RW', 'AM'],
  defending: ['CB', 'LB', 'RB', 'DM'],
  dribbling: ['LW', 'RW', 'AM', 'LM', 'RM'],
  keeping: ['GK'],
};
export function actionQuality(player: Pick<PlayerSnapshot, 'overall' | 'position'>, skill: Skill) {
  const positionBonus = specialists[skill].includes(player.position) ? 4 : 0;
  const keeperPenalty =
    player.position === 'GK' && skill !== 'keeping' && skill !== 'passing' ? 12 : 0;
  return Math.max(1, Math.min(99, player.overall + positionBonus - keeperPenalty));
}
/** Bounded odds multiplier: quality helps without guaranteeing the outcome. */
export function actionChance(base: number, quality: number, opposition = 65) {
  const factor = Math.max(0.55, Math.min(1.65, 1 + (quality - opposition) * 0.018));
  return Math.max(0.01, Math.min(0.97, base * factor));
}
