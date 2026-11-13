import { crowdNoise, type CrowdSeat } from './stadium-seating';
export type FlareOrigin = CrowdSeat & {
  color: string;
  flow: readonly [number, number, number];
  travel: number;
};
export function visitorCrowdSeat(seat: CrowdSeat): boolean {
  return (Math.atan2(seat.z, seat.x) + Math.PI) / (2 * Math.PI) < 0.3;
}
/** Stable irregular locations, separate supporters' colors and the measured rise of the local rows. */
export function flareOrigins(
  seats: readonly CrowdSeat[],
  homeColor: string,
  awayColor: string,
  limit: number,
  fit: (seat: CrowdSeat, flow: readonly number[]) => number = () => 1,
): FlareOrigin[] {
  const result: FlareOrigin[] = [];
  const visitors = Math.max(1, Math.round(limit * 0.3));
  for (const visitor of [false, true]) {
    const candidates = seats
      .filter((s) => visitorCrowdSeat(s) === visitor)
      .map((s) => ({ seat: s, rank: crowdNoise(Math.round(s.x * 197 + s.y * 991 + s.z * 401)) }))
      .sort((a, b) => a.rank - b.rank);
    const quota = visitor ? visitors : limit - visitors;
    let selected = 0;
    const fallback: FlareOrigin[] = [];
    for (const { seat } of candidates) {
      if (selected >= quota) break;
      if (result.some((s) => Math.hypot(s.x - seat.x, s.z - seat.z) < 13)) continue;
      const radial = Math.hypot(seat.x, seat.z) || 1,
        rx = seat.x / radial,
        rz = seat.z / radial;
      let flow: readonly [number, number, number] = [rx * 1.5, 1, rz * 1.5],
        best = Infinity;
      for (const other of seats) {
        const dx = other.x - seat.x,
          dz = other.z - seat.z,
          dy = other.y - seat.y;
        const forward = dx * rx + dz * rz,
          lateral = Math.abs(dx * rz - dz * rx);
        if (dy < 0.18 || dy > 2.5 || forward < 0.5 || forward > 5 || lateral > 1) continue;
        const score = forward + lateral * 3;
        if (score >= best) continue;
        best = score;
        flow = [Math.max(-2.5, Math.min(2.5, dx / dy)), 1, Math.max(-2.5, Math.min(2.5, dz / dy))];
      }
      const travel = fit(seat, flow);
      if (travel < 0.06) continue;
      const origin = { ...seat, color: visitor ? awayColor : homeColor, flow, travel };
      // Prefer space for substantial clouds, retaining sheltered positions as fallback.
      if (travel < 0.42) {
        fallback.push(origin);
        if (fallback.length < 80) continue;
        break;
      }
      result.push(origin);
      selected++;
    }
    for (const origin of fallback.sort((a, b) => b.travel - a.travel)) {
      if (selected >= quota) break;
      if (result.some((s) => Math.hypot(s.x - origin.x, s.z - origin.z) < 13)) continue;
      result.push(origin);
      selected++;
    }
  }
  return result;
}

/** ParticleField adds 1.35m; align it with the raised hand's flare tip (2m above the tread). */
export function flareEmitter(seat: CrowdSeat): CrowdSeat {
  const c = Math.cos(seat.rotation),
    s = Math.sin(seat.rotation);
  return {
    ...seat,
    x: seat.x + c * 0.32 + s * 0.08,
    y: seat.y + 0.225,
    z: seat.z - s * 0.32 + c * 0.08,
  };
}
