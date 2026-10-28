import { penaltyPositions, type MatchResult } from '@football/shared';
type Action = NonNullable<MatchResult['actions']>[number];
export type Point = { x: number; z: number };
export type PlaybackFrame = {
  minute: number;
  endMinute: number;
  action: Action;
  from: Record<string, Point>;
  to: Record<string, Point>;
  ballFrom: Point;
  ballTo: Point;
  dismissed: string[];
  keeperEnds: Record<string, number>;
};
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
});
export function buildPlayback(
  actions: readonly Action[],
  home: string[],
  away: string[],
  keepers: string[] = [],
): PlaybackFrame[] {
  const bases: Record<string, Point> = {};
  for (const [ids, direction] of [
    [home, 1],
    [away, -1],
  ] as const)
    ids.forEach((id, slot) => {
      bases[id] = {
        x: slot === 0 ? 0 : (((slot - 1) % 4) - 1.5) * 14,
        z: (slot === 0 ? -46 : slot < 5 ? -27 : slot < 8 ? -7 : 20) * direction,
      };
    });
  const keeperEnds = Object.fromEntries(keepers.map((id) => [id, home.includes(id) ? -1 : 1]));
  let lastDive: Partial<Action> = {};
  let positions = { ...bases };
  let ball: Point = { x: 0, z: 0 };
  const dismissed = new Set<string>();
  const grouped = new Map<number, Action[]>();
  for (const action of actions)
    grouped.set(action.minute, [...(grouped.get(action.minute) ?? []), action]);
  const groups = [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  let restart = false;
  let holder: string | undefined;
  return groups.map(([minute, events], index) => {
    let action =
      events.find((a) => a.type === 'shot') ??
      events.find((a) => a.type === 'pass') ??
      events.find((a) => a.type === 'tackle') ??
      events.find((a) => a.type === 'dribble') ??
      events[0]!;
    if (action.type === 'shot') {
      const outcome =
        action.outcome ??
        (events.some((event) => event.type === 'goal')
          ? 'goal'
          : action.onTarget
            ? 'saved'
            : 'wide');
      const keeperId =
        action.keeperId ??
        (action.side === 'home' ? away : home).find((id) => keepers.includes(id));
      action = {
        ...action,
        outcome,
        ...(keeperId && (outcome === 'saved' || outcome === 'goal')
          ? { keeperId, keeperDive: action.keeperDive ?? (action.x < 0 ? 'left' : 'right') }
          : {}),
      };
      if (
        outcome !== 'goal' &&
        Math.abs(action.endX ?? 0) < 3.65 &&
        Math.abs(action.endZ ?? 52) > 50
      ) {
        action = {
          ...action,
          endZ: outcome === 'saved' ? (action.side === 'home' ? 47 : -47) : action.endZ,
          endX: outcome === 'saved' ? action.endX : 8,
        };
      }
      lastDive = {
        ...(action.keeperId ? { keeperId: action.keeperId } : {}),
        ...(action.keeperDive ? { keeperDive: action.keeperDive } : {}),
      };
    } else if (action.type === 'save') action = { ...action, ...lastDive };
    let recorded =
      action.positions ??
      (action.coordinates
        ? Object.fromEntries(
            [...home, ...away].map((id, index) => [
              id,
              {
                x: (action.coordinates?.[index * 2] ?? 0) / 10,
                z: (action.coordinates?.[index * 2 + 1] ?? 0) / 10,
              },
            ]),
          )
        : undefined);
    const penalty =
      action.type === 'penalty' || (action.type === 'shot' && action.setPiece === 'penalty');
    if (penalty) {
      const defendingKeeper =
        action.keeperId ??
        (action.side === 'home' ? away : home).find((id) => keepers.includes(id));
      recorded = penaltyPositions(
        recorded ?? positions,
        action.playerId,
        defendingKeeper,
        { x: action.x, z: action.z },
        action.minute >= 90,
      );
    }
    if (recorded) {
      for (const event of events)
        if (event.type === 'red' && event.playerId) dismissed.add(event.playerId);
      const resets = ['kickoff', 'goal-kick', 'corner', 'free-kick', 'penalty'].includes(
        action.type,
      );
      const from = resets || penalty ? { ...recorded } : { ...positions };
      const to = { ...recorded };
      // Persisted spatial actions are authoritative: never invent another ball or player path.
      const frame = {
        minute,
        endMinute: groups[index + 1]?.[0] ?? (minute >= 90 ? minute + 0.5 : 90),
        action,
        from,
        to,
        ballFrom: { x: action.x, z: action.z },
        ballTo: { x: action.endX ?? action.x, z: action.endZ ?? action.z },
        dismissed: [...dismissed],
        keeperEnds,
      };
      positions = to;
      return frame;
    }
    for (const event of events)
      if (event.type === 'red' && event.playerId) dismissed.add(event.playerId);
    if (restart || action.type === 'kickoff') {
      positions = { ...bases };
      ball = { x: 0, z: 0 };
      const taker = action.playerId ?? groups[index + 1]?.[1].find((a) => a.playerId)?.playerId;
      if (taker) positions[taker] = { x: 0, z: 0 };
      holder = taker;
    }
    const from = { ...positions };
    const to = { ...positions };
    // Teammates offer passing lanes, without converging on the ball carrier.
    for (const [id, base] of Object.entries(bases)) {
      const current = positions[id]!;
      const desired = {
        x: Math.max(-31, Math.min(31, base.x + ball.x * 0.18)),
        z: Math.max(-47, Math.min(47, base.z + ball.z * 0.22)),
      };
      const distance = Math.hypot(desired.x - current.x, desired.z - current.z);
      to[id] = mix(current, desired, Math.min(1, 3 / Math.max(1, distance)));
    }
    if (holder && to[holder]) to[holder] = { ...ball };
    const ballFrom = { ...ball };
    let ballTo = { ...ball };
    if (
      action.type === 'pass' &&
      action.playerId &&
      action.targetId &&
      from[action.playerId] &&
      to[action.targetId]
    ) {
      // The passer stays at the departure point; the receiver waits at the endpoint.
      from[action.playerId] = ballFrom;
      to[action.playerId] = ballFrom;
      const receiver = to[action.targetId]!;
      ballTo = { ...receiver };
      holder = action.targetId;
    } else if (action.type === 'shot') {
      if (action.playerId && from[action.playerId]) {
        from[action.playerId] = ballFrom;
        to[action.playerId] = ballFrom;
      }
      ballTo = {
        x: events.some((a) => a.type === 'goal')
          ? Math.max(-3, Math.min(3, action.x * 0.08))
          : action.onTarget
            ? 0
            : 7,
        z:
          (action.side === 'home' ? 1 : -1) *
          (action.outcome === 'goal' ? 52 : action.onTarget ? 47 : 52),
      };
    } else if (action.type === 'tackle' && action.playerId && to[action.playerId]) {
      ballTo = { ...to[action.playerId]! };
      holder = action.playerId;
    } else if (action.type === 'corner') {
      ballTo = { x: action.x, z: action.z };
    }
    restart = events.some((a) => a.type === 'goal');
    const frame = {
      minute,
      endMinute: groups[index + 1]?.[0] ?? 90.5,
      action,
      from,
      to,
      ballFrom,
      ballTo,
      dismissed: [...dismissed],
      keeperEnds,
    };
    positions = to;
    ball = ballTo;
    return frame;
  });
}
export function samplePlayback(frames: readonly PlaybackFrame[], minute: number) {
  const frame = frames.find((f) => f.minute <= minute && f.endMinute > minute) ?? frames.at(-1);
  if (!frame)
    return {
      positions: {} as Record<string, Point>,
      ball: { x: 0, z: 0 },
      height: 0.45,
      frame: undefined,
      progress: 0,
    };
  const progress = Math.max(
    0,
    Math.min(1, (minute - frame.minute) / (frame.endMinute - frame.minute)),
  );
  const movement = Math.min(1, progress / 0.8);
  const flight = ['tackle', 'interception'].includes(frame.action.type)
    ? Math.min(1, progress / 0.25)
    : frame.action.type === 'dribble'
      ? movement
      : Math.max(0, Math.min(1, (progress - 0.12) / 0.72));
  const positions = Object.fromEntries(
    Object.entries(frame.from).map(([id, point]) => [
      id,
      mix(point, frame.to[id] ?? point, movement),
    ]),
  );
  const anchors = [frame.action.playerId, ...Object.keys(frame.keeperEnds)];
  if (flight > 0.8 && frame.action.targetId && frame.action.outcome !== 'intercepted')
    anchors.push(frame.action.targetId);
  separatePositions(
    positions,
    anchors.filter((id): id is string => Boolean(id)),
    frame.action.type === 'penalty' || frame.action.setPiece === 'penalty' ? {} : frame.keeperEnds,
  );
  return {
    positions,
    ball: mix(frame.ballFrom, frame.ballTo, flight),
    height:
      (frame.action.startHeight ?? 0.45) * (1 - flight) +
      (frame.action.endHeight ?? 0.45) * flight +
      Math.sin(flight * Math.PI) *
        (frame.action.arc ??
          (frame.action.type === 'cross'
            ? 7
            : frame.action.type === 'shot'
              ? 0.6
              : frame.action.type === 'pass'
                ? 0.25
                : 0)),
    frame,
    progress,
  };
}

export function separatePositions(
  positions: Record<string, Point>,
  anchors: string[] = [],
  keeperEnds: Record<string, number> = {},
) {
  const ids = Object.keys(positions);
  const constrain = (id: string, p: Point): Point => {
    const end = keeperEnds[id];
    return {
      x: Math.max(end ? -6 : -31.5, Math.min(end ? 6 : 31.5, p.x)),
      z: end ? Math.max(42, Math.min(48, p.z * end)) * end : Math.max(-49.5, Math.min(49.5, p.z)),
    };
  };
  for (let iteration = 0; iteration < 10; iteration++) {
    let collisions = false;
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!,
          b = ids[j]!,
          pa = positions[a]!,
          pb = positions[b]!;
        const vx = pb.x - pa.x,
          vz = pb.z - pa.z,
          squared = vx * vx + vz * vz;
        if (squared >= 1.6 * 1.6) continue;
        collisions = true;
        const distance = Math.sqrt(squared);
        const dx = distance > 0.001 ? vx / distance : Math.cos((i * 7 + j * 3) * 2.399),
          dz = distance > 0.001 ? vz / distance : Math.sin((i * 7 + j * 3) * 2.399);
        const fixedA = anchors.includes(a),
          fixedB = anchors.includes(b);
        const wa = fixedA && !fixedB ? 0 : fixedB && !fixedA ? 1 : 0.5,
          wb = 1 - wa;
        positions[a] = constrain(a, {
          x: pa.x - dx * (1.65 - distance) * wa,
          z: pa.z - dz * (1.65 - distance) * wa,
        });
        positions[b] = constrain(b, {
          x: pb.x + dx * (1.65 - distance) * wb,
          z: pb.z + dz * (1.65 - distance) * wb,
        });
      }
    if (!collisions) break;
  }
  for (const [id, p] of Object.entries(positions)) positions[id] = constrain(id, p);
}
export function visibleActionMinute(actions: readonly Action[], index: number) {
  const action = actions[index];
  if (!action) return 90;
  if (action.type !== 'goal') return action.minute;
  const next = actions.slice(index + 1).find((event) => event.minute > action.minute)?.minute ?? 90;
  return action.minute + (next - action.minute) * 0.88;
}
