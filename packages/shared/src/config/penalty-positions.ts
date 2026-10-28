type Point = { x: number; z: number };

/** Keep waiting players clear of the penalty taker and the defending goalkeeper. */
export function penaltyPositions(
  positions: Record<string, Point>,
  takerId: string | undefined,
  keeperId: string | undefined,
  spot: Point,
  shootout = false,
): Record<string, Point> {
  const direction = spot.z >= 0 ? 1 : -1;
  const arranged = { ...positions };
  const waiting = Object.keys(positions).filter((id) => id !== takerId && id !== keeperId);
  waiting.forEach((id, index) => {
    if (shootout) {
      // Stagger short rows around the centre circle instead of a rigid straight line.
      const column = index % 7;
      const row = Math.floor(index / 7);
      arranged[id] = {
        x: (column - 3) * 2.15 + Math.sin(index * 2.4) * 0.3,
        z: (row - 1) * 2.5 + Math.cos(index * 1.7) * 0.35,
      };
    } else {
      const current = positions[id]!;
      // Behind the spot, outside both penalty areas, and clear of the penalty arc.
      arranged[id] = { x: current.x, z: Math.max(-28, Math.min(28, current.z)) };
    }
  });
  if (takerId) arranged[takerId] = { ...spot };
  if (keeperId) arranged[keeperId] = { x: 0, z: direction * 49.5 };
  return arranged;
}
