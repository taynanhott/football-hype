import type { WorldState } from '@football/shared';

/** Freeze the remaining cycle time across injury, including same-day updates. */
export function syncIndividualTraining(state: WorldState, at: number): WorldState {
  let changed = false;
  const centers = { ...state.centers.byId };
  for (const center of Object.values(centers)) {
    const ops = center.operations;
    if (!ops?.individual.length) continue;
    let updated = false;
    const individual = ops.individual.map((plan) => {
      if ((state.injuries[plan.playerId] ?? 0) > 0 && plan.pausedAt === undefined) {
        updated = true;
        return { ...plan, pausedAt: Math.max(plan.startedAt, at) };
      }
      if (!(state.injuries[plan.playerId] ?? 0) && plan.pausedAt !== undefined) {
        updated = true;
        const { pausedAt, ...active } = plan;
        return { ...active, endsAt: plan.endsAt + Math.max(0, at - pausedAt) };
      }
      return plan;
    });
    if (updated) {
      changed = true;
      centers[center.id] = { ...center, operations: { ...ops, individual } };
    }
  }
  return changed ? { ...state, centers: { ...state.centers, byId: centers } } : state;
}
