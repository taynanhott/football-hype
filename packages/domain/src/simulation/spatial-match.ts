import {
  penaltyPositions,
  type MatchResult,
  type PlayerSnapshot,
  type PlayStyle,
} from '@football/shared';
type Side = 'home' | 'away';
type Point = { x: number; z: number };
type Action = NonNullable<MatchResult['actions']>[number];
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const round = (p: Point): Point => ({ x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 });
const move = (p: Point, q: Point, speed: number): Point => {
  const ratio = Math.min(1, speed / Math.max(0.001, distance(p, q)));
  return round({
    x: clamp(p.x + (q.x - p.x) * ratio, -31, 31),
    z: clamp(p.z + (q.z - p.z) * ratio, -48, 48),
  });
};
export function spatialMatch(
  home: readonly PlayerSnapshot[],
  away: readonly PlayerSnapshot[],
  random: () => number,
  strength: number,
  styles: { home: PlayStyle; away: PlayStyle } = { home: 'balanced', away: 'balanced' },
) {
  const teams = { home, away };
  const players = [...home, ...away];
  const poses: Record<string, Point> = {};
  const bases: Record<string, Point> = {};
  const dismissed = new Set<string>();
  const yellows = new Set<string>();
  const ratings = Object.fromEntries(players.map((p) => [p.id, 6]));
  const direction = (side: Side) => (side === 'home' ? 1 : -1);
  const eligible = (side: Side) => teams[side].filter((p) => !dismissed.has(p.id));
  const field = (side: Side) => eligible(side).filter((p) => p.position !== 'GK');
  const keeper = (side: Side) => eligible(side).find((p) => p.position === 'GK');
  const stats = () => ({
    possession: 0,
    shots: 0,
    shotsOnTarget: 0,
    xg: 0,
    passes: 0,
    corners: 0,
    fouls: 0,
  });
  const statistics = { home: stats(), away: stats() };
  const actions: Action[] = [];
  const scorers: MatchResult['scorers'] = [];
  let homeGoals = 0,
    awayGoals = 0;
  let side: Side = random() < 0.5 ? 'home' : 'away';
  let carrier: PlayerSnapshot | undefined;
  let ball: Point = { x: 0, z: 0 };
  let phase:
    | 'kickoff'
    | 'play'
    | 'goal-kick'
    | 'save'
    | 'corner'
    | 'interception'
    | 'free-kick'
    | 'cross'
    | 'set-piece-shot' = 'kickoff';
  let setup = false,
    hold = 0;
  let wallIds: string[] = [];
  let setPiece: Action['setPiece'];
  let incoming: { player: PlayerSnapshot; side: Side } | undefined;
  let crossTarget: PlayerSnapshot | undefined;
  let lastDive: Pick<Action, 'keeperId' | 'keeperDive'> = {};
  let passesInAttack = 0;
  let assist: { id: string; receiver: string; side: Side; step: number } | undefined;
  for (const team of ['home', 'away'] as const) {
    const counts: Record<string, number> = {};
    teams[team].forEach((p, index) => {
      const n = counts[p.position] ?? 0;
      counts[p.position] = n + 1;
      const depth: Record<string, number> = {
        GK: -47,
        CB: -30,
        LB: -26,
        RB: -26,
        DM: -15,
        CM: -3,
        AM: 12,
        LW: 22,
        RW: 22,
        LM: 4,
        RM: 4,
        ST: 29,
      };
      const width: Record<string, number> = {
        GK: 0,
        CB: (n - (teams[team].filter((other) => other.position === 'CB').length - 1) / 2) * 11,
        LB: -26,
        RB: 26,
        DM: n % 2 ? -8 : 8,
        CM: (n - (teams[team].filter((other) => other.position === 'CM').length - 1) / 2) * 13,
        AM: 0,
        LW: -25,
        RW: 25,
        LM: -25,
        RM: 25,
        ST: (n - (teams[team].filter((other) => other.position === 'ST').length - 1) / 2) * 10,
      };
      bases[p.id] = {
        x: width[p.position] ?? ((index % 4) - 1.5) * 12,
        z: (depth[p.position] ?? 0) * direction(team),
      };
      poses[p.id] = { ...bases[p.id]! };
    });
  }
  const allActive = () => [
    ...new Map(players.filter((p) => !dismissed.has(p.id)).map((p) => [p.id, p])).values(),
  ];
  const constrain = (player: PlayerSnapshot, point: Point) => {
    const team: Side = home.some((p) => p.id === player.id) ? 'home' : 'away';
    return player.position === 'GK'
      ? round({
          x: clamp(point.x, -6, 6),
          z: clamp(point.z * direction(team), -48, -42) * direction(team),
        })
      : round({ x: clamp(point.x, -31.5, 31.5), z: clamp(point.z, -49.5, 49.5) });
  };
  const separate = (anchor?: string) => {
    const active = allActive();
    for (let iteration = 0; iteration < 10; iteration++) {
      let collisions = false;
      for (let i = 0; i < active.length; i++)
        for (let j = i + 1; j < active.length; j++) {
          const a = active[i]!,
            b = active[j]!,
            pa = poses[a.id]!,
            pb = poses[b.id]!;
          const vx = pb.x - pa.x,
            vz = pb.z - pa.z,
            squared = vx * vx + vz * vz;
          if (squared >= 1.85 * 1.85) continue;
          collisions = true;
          const gap = Math.sqrt(squared),
            angle = (i * 7 + j * 3) * 2.399;
          const dx = gap > 0.01 ? vx / gap : Math.cos(angle),
            dz = gap > 0.01 ? vz / gap : Math.sin(angle);
          const push = 1.9 - gap;
          const wa = a.id === anchor ? 0 : b.id === anchor ? 1 : 0.5,
            wb = b.id === anchor ? 0 : a.id === anchor ? 1 : 0.5;
          poses[a.id] = constrain(a, { x: pa.x - dx * push * wa, z: pa.z - dz * push * wa });
          poses[b.id] = constrain(b, { x: pb.x + dx * push * wb, z: pb.z + dz * push * wb });
        }
      if (!collisions) break;
    }
  };
  const projection = (point: Point, start: Point, end: Point) => {
    const dx = end.x - start.x,
      dz = end.z - start.z;
    const t = clamp(
      ((point.x - start.x) * dx + (point.z - start.z) * dz) / Math.max(0.01, dx * dx + dz * dz),
      0,
      1,
    );
    const contact = { x: start.x + t * dx, z: start.z + t * dz };
    return { t, contact, gap: distance(point, contact) };
  };
  const emit = (
    minute: number,
    type: Action['type'],
    actor: PlayerSnapshot | undefined,
    from: Point,
    to: Point,
    extra: Partial<Action> = {},
  ) => {
    if ((type === 'penalty' || type === 'shot') && extra.setPiece === 'penalty') {
      Object.assign(
        poses,
        penaltyPositions(poses, actor?.id, keeper(side === 'home' ? 'away' : 'home')?.id, from),
      );
    }
    actions.push({
      minute,
      type,
      side,
      x: clamp(from.x, -32, 32),
      z: clamp(from.z, -50, 50),
      endX: clamp(to.x, -35, 35),
      endZ: clamp(to.z, -55, 55),
      ...(actor ? { playerId: actor.id } : {}),
      coordinates: players.flatMap((p) => {
        const point = poses[p.id]!;
        return [Math.round(point.x * 10), Math.round(point.z * 10)];
      }),
      ...extra,
    });
  };
  // Movement and the ball share the same pitch coordinates on the server and in 3D.
  for (let step = 0; step < 180; step++) {
    const minute = (step * 90) / 180;
    const opposite: Side = side === 'home' ? 'away' : 'home';
    const dir = direction(side);
    statistics[side].possession++;
    if (phase === 'kickoff') {
      for (const p of players) poses[p.id] = { ...bases[p.id]! };
      carrier = field(side).find((p) => p.position === 'ST') ?? field(side)[0];
      ball = { x: 0, z: 0 };
      if (carrier) poses[carrier.id] = { ...ball };
      separate(carrier?.id);
      emit(minute, 'kickoff', carrier, ball, ball);
      phase = 'play';
      passesInAttack = 0;
      assist = undefined;
      continue;
    }
    if (phase === 'goal-kick' || phase === 'save') {
      carrier = keeper(side) ?? field(side)[0];
      const target = { x: clamp(ball.x * 0.3, -6, 6), z: -direction(side) * 46 };
      if (carrier) poses[carrier.id] = target;
      const from = phase === 'save' ? { ...ball } : { ...target };
      ball = target;
      separate(carrier?.id);
      emit(minute, phase, carrier, from, ball, phase === 'save' ? lastDive : {});
      phase = 'play';
      passesInAttack = 0;
      assist = undefined;
      continue;
    }
    if (phase === 'interception' && incoming) {
      side = incoming.side;
      carrier = incoming.player;
      ball = { ...poses[carrier.id]! };
      separate(carrier.id);
      emit(minute, 'interception', carrier, ball, ball, { outcome: 'intercepted' });
      incoming = undefined;
      phase = 'play';
      passesInAttack = 0;
      assist = undefined;
      continue;
    }
    if (phase === 'corner' || phase === 'free-kick') {
      if (!setup) {
        if (phase === 'corner') {
          carrier =
            field(side).find((p) => p.position === (ball.x < 0 ? 'LW' : 'RW')) ?? field(side)[0];
          ball = { x: ball.x < 0 ? -31.5 : 31.5, z: dir * 49.5 };
          const attackers = field(side)
            .filter((p) => p.id !== carrier?.id)
            .sort(
              (a, b) =>
                Number(['ST', 'CB', 'AM'].includes(b.position)) -
                Number(['ST', 'CB', 'AM'].includes(a.position)),
            )
            .slice(0, 5);
          const defenders = field(opposite).slice(0, 5);
          attackers.forEach((p, index) => {
            poses[p.id] = { x: (index - 2) * 5, z: dir * (36 + (index % 2) * 4) };
            const marker = defenders[index];
            if (marker)
              poses[marker.id] = { x: (index - 2) * 5 + 2, z: dir * (37 + (index % 2) * 4) };
          });
          crossTarget = attackers.find((p) => p.position === 'ST') ?? attackers[0];
          setPiece = 'corner';
          wallIds = [];
          hold = 2;
        } else {
          const penalty = ball.z * dir > 34.5 && Math.abs(ball.x) < 20;
          setPiece = penalty ? 'penalty' : 'free-kick';
          if (penalty) ball = { x: 0, z: dir * 39 };
          carrier = field(side).sort((a, b) => b.overall - a.overall)[0];
          const length = Math.hypot(ball.x, 51 - ball.z * dir);
          wallIds =
            !penalty && length <= 34
              ? field(opposite)
                  .slice(0, 4)
                  .map((p) => p.id)
              : [];
          const toward = {
            x: -ball.x / Math.max(1, length),
            z: (dir * 51 - ball.z) / Math.max(1, length),
          };
          wallIds.forEach((id, index) => {
            const offset = (index - (wallIds.length - 1) / 2) * 1.9;
            poses[id] = round({
              x: ball.x + toward.x * 9.15 - toward.z * offset,
              z: ball.z + toward.z * 9.15 + toward.x * offset,
            });
          });
          hold = wallIds.length || penalty ? 3 : 1;
        }
        if (carrier) poses[carrier.id] = { ...ball };
        separate(carrier?.id);
        emit(
          minute,
          phase === 'corner' ? 'corner' : setPiece === 'penalty' ? 'penalty' : 'free-kick',
          carrier,
          ball,
          ball,
          { wallIds: [...wallIds], setPiece },
        );
        setup = true;
        continue;
      }
      if (hold-- > 0) continue;
      setup = false;
      phase =
        phase === 'corner'
          ? 'cross'
          : wallIds.length || setPiece === 'penalty'
            ? 'set-piece-shot'
            : 'play';
      continue;
    }
    if (phase === 'cross' && carrier && crossTarget && !dismissed.has(crossTarget.id)) {
      separate(carrier.id);
      const marker = field(opposite).sort(
        (a, b) =>
          distance(poses[a.id]!, poses[crossTarget!.id]!) -
          distance(poses[b.id]!, poses[crossTarget!.id]!),
      )[0];
      const intercepted = Boolean(
        marker && distance(poses[marker.id]!, poses[crossTarget.id]!) < 5 && random() < 0.25,
      );
      const destination = { ...poses[intercepted && marker ? marker.id : crossTarget.id]! };
      emit(minute, 'cross', carrier, ball, destination, {
        targetId: crossTarget.id,
        setPiece: 'corner',
        outcome: intercepted ? 'intercepted' : 'complete',
        ...(intercepted && marker ? { interceptorId: marker.id } : {}),
        arc: 7,
        endHeight: 2.7,
      });
      statistics[side].passes++;
      if (intercepted && marker) {
        incoming = { player: marker, side: opposite };
        phase = 'interception';
        assist = undefined;
      } else {
        assist = { id: carrier.id, receiver: crossTarget.id, side, step };
        carrier = crossTarget;
        phase = 'set-piece-shot';
      }
      ball = destination;
      passesInAttack = 2;
      continue;
    }
    const forceShot: boolean = phase === 'set-piece-shot';
    if (forceShot) phase = 'play';
    if (!carrier || dismissed.has(carrier.id))
      carrier = field(side).sort(
        (a, b) => distance(poses[a.id]!, ball) - distance(poses[b.id]!, ball),
      )[0];
    if (!carrier) {
      emit(minute, 'kickoff', undefined, ball, ball);
      continue;
    }
    const origin = { ...poses[carrier.id]! };
    ball = origin;
    const challengers = field(opposite).sort(
      (a, b) => distance(poses[a.id]!, ball) - distance(poses[b.id]!, ball),
    );
    const presser = challengers[0];
    // Advance supporting lines in possession; recover and track runners after losing it.
    for (const team of ['home', 'away'] as const)
      for (const p of eligible(team)) {
        if (p.id === carrier.id) continue;
        const d = direction(team),
          base = bases[p.id]!;
        if (p.position === 'GK') {
          poses[p.id] = move(
            poses[p.id]!,
            {
              x: clamp(ball.x * 0.16, -5, 5),
              z: -d * (46 - clamp((-ball.z * d - 20) * 0.1, 0, 3)),
            },
            1.2,
          );
          continue;
        }
        const owns = team === side;
        const localBall = ball.z * d;
        const defensive = ['CB', 'LB', 'RB'].includes(p.position);
        let desired = {
          x: clamp(base.x + ball.x * (owns ? 0.22 : 0.4), -29, 29),
          z: clamp(base.z * d + localBall * (owns ? 0.65 : 0.5) + (owns ? 8 : -9), -39, 41) * d,
        };
        if (defensive) desired.z = clamp(-29 + localBall * 0.35 + (owns ? 12 : -2), -40, 7) * d;
        if (!owns && presser?.id === p.id) desired = { x: ball.x, z: ball.z - dir * 1.5 };
        else if (!owns && challengers[1]?.id === p.id)
          desired = { x: ball.x + (base.x < ball.x ? -5 : 5), z: ball.z - dir * 5 };
        if (owns && !defensive && p.position !== 'DM')
          desired.x = clamp(desired.x + Math.sin(step * 0.35 + base.x) * 3, -29, 29);
        if (!owns && styles[team] === 'low-block')
          desired.z = clamp(desired.z * d - 5, -43, 20) * d;
        if (owns && styles[team] === 'wings' && ['LW', 'RW', 'LM', 'RM'].includes(p.position))
          desired.x = clamp(desired.x * 1.13, -30, 30);
        poses[p.id] = move(poses[p.id]!, desired, styles[team] === 'gegenpress' ? 3.7 : 3.5);
      }
    separate(carrier.id);
    const pressure = presser ? distance(poses[presser.id]!, ball) : 100;
    if (
      !forceShot &&
      presser &&
      pressure < (styles[opposite] === 'gegenpress' ? 5.2 : 4.5) &&
      random() < (styles[opposite] === 'gegenpress' ? 0.27 : 0.22)
    ) {
      const offenderSide = opposite;
      if (random() < 0.4) {
        statistics[offenderSide].fouls++;
        emit(minute, 'foul', presser, ball, ball, { side: offenderSide });
        phase = 'free-kick';
        setup = false;
        if (random() < 0.25) {
          const red = yellows.has(presser.id) || random() < 0.02;
          emit(minute, red ? 'red' : 'yellow', presser, ball, ball, { side: offenderSide });
          if (red) dismissed.add(presser.id);
          else yellows.add(presser.id);
          ratings[presser.id] = (ratings[presser.id] ?? 6) - (red ? 2 : 0.4);
        }
      } else {
        poses[presser.id] = move(poses[presser.id]!, ball, Math.max(0, pressure - 1.9));
        separate(carrier.id);
        emit(minute, 'tackle', presser, origin, poses[presser.id]!, { side: opposite });
        carrier = presser;
        side = opposite;
        ball = { ...poses[presser.id]! };
        passesInAttack = 0;
        assist = undefined;
      }
      continue;
    }
    const goalDistance = Math.hypot(ball.x, 51 - ball.z * dir);
    const canShoot =
      carrier.position !== 'GK' &&
      ball.z * dir >= (forceShot ? 17 : 27) &&
      Math.abs(ball.x) < 23 &&
      goalDistance <= (forceShot && setPiece === 'free-kick' ? 34 : 26);
    if (
      canShoot &&
      (forceShot || ((passesInAttack >= 2 || goalDistance < 14) && random() < 0.28))
    ) {
      const xg: number =
        forceShot && setPiece === 'penalty'
          ? 0.76
          : clamp(
              0.43 -
                goalDistance * 0.012 -
                Math.abs(ball.x) * 0.004 -
                (pressure < 3 ? 0.07 : 0) +
                (side === 'home' ? strength : -strength) / 1200,
              0.025,
              0.58,
            );
      const goal: boolean = random() < xg;
      const outcome: Action['outcome'] = goal
        ? 'goal'
        : random() < 0.28
          ? 'blocked'
          : random() < 0.6
            ? 'saved'
            : 'wide';
      const onTarget: boolean = outcome === 'goal' || outcome === 'saved';
      const goalie = keeper(opposite),
        gp = goalie ? poses[goalie.id]! : { x: 0, z: dir * 46 };
      const shotX = clamp(ball.x * 0.12 + (random() - 0.5) * 2, -3, 3);
      const dive = shotX < gp.x - 0.4 ? 'left' : shotX > gp.x + 0.4 ? 'right' : 'center';
      lastDive = { ...(goalie ? { keeperId: goalie.id } : {}), keeperDive: dive };
      const endpoint =
        outcome === 'saved'
          ? round({
              x: clamp(gp.x + (dive === 'left' ? -1.7 : dive === 'right' ? 1.7 : 0), -6, 6),
              z: gp.z,
            })
          : { x: goal ? shotX : random() < 0.5 ? -9 : 9, z: dir * 52 };
      statistics[side].shots++;
      statistics[side].xg += xg;
      if (onTarget) statistics[side].shotsOnTarget++;
      const shotMeta: Partial<Action> = {
        outcome,
        onTarget,
        xg,
        ...(onTarget ? lastDive : {}),
        ...(forceShot ? { setPiece, wallIds: [...wallIds], header: setPiece === 'corner' } : {}),
        startHeight: forceShot && setPiece === 'corner' ? 2.7 : 0.45,
        endHeight: outcome === 'saved' ? 1.5 : goal ? 0.9 : 0.45,
        arc: outcome === 'saved' ? 0.6 : goal ? 0.6 : 0.8,
      };
      emit(minute, 'shot', carrier, ball, endpoint, shotMeta);
      if (goal) {
        const assistId =
          assist?.side === side &&
          assist.receiver === carrier.id &&
          step - assist.step < 5 &&
          assist.id !== carrier.id
            ? assist.id
            : undefined;
        emit(minute, 'goal', carrier, ball, endpoint, {
          ...shotMeta,
          ...(assistId ? { assistId } : {}),
        });
        scorers.push({
          playerId: carrier.id,
          minute: Math.max(1, Math.ceil(minute)),
          side,
          ...(assistId ? { assistId } : {}),
        });
        if (side === 'home') homeGoals++;
        else awayGoals++;
        ratings[carrier.id] = (ratings[carrier.id] ?? 6) + 1;
        if (assistId) ratings[assistId] = (ratings[assistId] ?? 6) + 0.6;
        side = opposite;
        phase = 'kickoff';
        carrier = undefined;
      } else if (outcome === 'blocked') {
        statistics[side].corners++;
        ball = { x: random() < 0.5 ? -32 : 32, z: dir * 50 };
        phase = 'corner';
        setup = false;
      } else {
        side = opposite;
        ball = endpoint;
        phase = onTarget ? 'save' : 'goal-kick';
        carrier = undefined;
      }
      setPiece = undefined;
      wallIds = [];
      continue;
    }
    const candidates = eligible(side)
      .filter((p) => p.id !== carrier!.id && (p.position !== 'GK' || ball.z * dir < -22))
      .map((p) => {
        const point = poses[p.id]!,
          length = distance(point, ball);
        const openness = Math.min(
          12,
          ...field(opposite).map((other) => distance(poses[other.id]!, point)),
        );
        // Prefer nearby open teammates progressing through midfield, rather than random IDs.
        const progression = (point.z - ball.z) * dir;
        const score =
          (styles[side] === 'wings' ? Math.abs(point.x) * 0.045 : 0) +
          (styles[side] === 'counter' ? clamp(progression, 0, 20) * 0.04 : 0) +
          (styles[side] === 'possession' ? -Math.abs(length - 10) * 0.035 : 0) +
          openness * 0.18 +
          clamp(progression, -12, 20) * 0.08 -
          Math.abs(length - 13) * 0.065 +
          (random() - 0.5) * 0.5;
        return { player: p, point, length, score };
      })
      .filter((c) => c.length >= 3 && c.length < 31)
      .sort((a, b) => b.score - a.score);
    const target = candidates[0];
    const passerId = carrier.id;
    if (
      target &&
      (carrier.position === 'GK' ||
        pressure < 5 ||
        random() <
          (styles[side] === 'possession' ? 0.78 : styles[side] === 'counter' ? 0.55 : 0.62))
    ) {
      const opponents = field(opposite)
        .map((p) => ({ player: p, ...projection(poses[p.id]!, ball, target.point) }))
        .filter((item) => item.t > 0.12 && item.t < 0.88 && item.gap < 2.4)
        .sort((a, b) => a.gap - b.gap);
      const interception = opponents[0];
      const intercepted = Boolean(interception && random() < 0.55);
      if (intercepted && interception) {
        poses[interception.player.id] = move(
          poses[interception.player.id]!,
          interception.contact,
          2.4,
        );
        separate(carrier.id);
        const endpoint = { ...poses[interception.player.id]! };
        emit(minute, 'pass', carrier, ball, endpoint, {
          targetId: target.player.id,
          interceptorId: interception.player.id,
          outcome: 'intercepted',
        });
        incoming = { player: interception.player, side: opposite };
        ball = endpoint;
        phase = 'interception';
        assist = undefined;
      } else {
        emit(minute, 'pass', carrier, ball, target.point, {
          targetId: target.player.id,
          outcome: 'complete',
        });
        assist = { id: carrier.id, receiver: target.player.id, side, step };
        carrier = target.player;
        ball = { ...target.point };
        passesInAttack++;
      }
      statistics[side].passes++;
      ratings[passerId] = (ratings[passerId] ?? 6) + (intercepted ? -0.03 : 0.008);
    } else if (carrier.position === 'GK') {
      // A goalkeeper distributes or waits in the area; never dribbles upfield.
      emit(minute, 'dribble', carrier, ball, ball);
    } else {
      const lateral =
        pressure < 5
          ? presser && poses[presser.id]!.x > ball.x
            ? -3
            : 3
          : Math.sin(step * 0.7) * 1.5;
      const destination = move(
        ball,
        { x: clamp(ball.x + lateral, -29, 29), z: clamp(ball.z + dir * 5, -45, 45) },
        4,
      );
      poses[carrier.id] = destination;
      separate();
      const endpoint = { ...poses[carrier.id]! };
      emit(minute, 'dribble', carrier, ball, endpoint);
      ball = endpoint;
    }
  }
  const possession = statistics.home.possession + statistics.away.possession;
  statistics.home.possession = Math.round(
    (statistics.home.possession / Math.max(1, possession)) * 100,
  );
  statistics.away.possession = 100 - statistics.home.possession;
  for (const team of ['home', 'away'] as const)
    statistics[team].xg = Math.round(statistics[team].xg * 100) / 100;
  // Evaluate participation and outcomes, so tactical roles are reflected in match ratings.
  for (const action of actions) {
    const id = action.playerId;
    if (id) {
      let delta = 0;
      if (action.type === 'pass') delta = action.outcome === 'intercepted' ? -0.12 : 0.018;
      if (action.type === 'shot')
        delta = action.outcome === 'goal' ? 0.25 : action.onTarget ? 0.18 : -0.16;
      if (action.type === 'tackle' || action.type === 'interception') delta = 0.22;
      if (action.type === 'dribble') delta = 0.07;
      if (action.type === 'cross') delta = action.outcome === 'complete' ? 0.12 : -0.05;
      if (action.type === 'foul') delta = -0.15;
      ratings[id] = (ratings[id] ?? 6) + delta;
    }
    if (action.type === 'shot' && action.keeperId)
      ratings[action.keeperId] =
        (ratings[action.keeperId] ?? 6) +
        (action.outcome === 'saved' ? 0.35 : action.outcome === 'goal' ? -0.5 : 0);
    if (action.type === 'pass' && action.interceptorId)
      ratings[action.interceptorId] = (ratings[action.interceptorId] ?? 6) + 0.18;
  }
  for (const team of ['home', 'away'] as const) {
    const conceded = team === 'home' ? awayGoals : homeGoals;
    for (const player of team === 'home' ? home : away) {
      const defending = ['CB', 'LB', 'RB', 'DM', 'GK'].includes(player.position);
      ratings[player.id] =
        (ratings[player.id] ?? 6) + (defending ? (conceded === 0 ? 0.7 : -conceded * 0.28) : 0);
    }
  }
  for (const id of Object.keys(ratings))
    ratings[id] = Math.round(clamp(ratings[id] ?? 6, 0, 10) * 10) / 10;
  return {
    actions,
    scorers,
    statistics,
    ratings,
    homeGoals,
    awayGoals,
    lineups: { home: home.map((p) => p.id), away: away.map((p) => p.id) },
  };
}
