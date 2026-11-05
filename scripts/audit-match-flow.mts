import {
  createWorld,
  simulateMatch,
  stableId,
  resolveLineup,
} from '../packages/domain/src/index.js';
const created = createWorld({
  id: stableId(100, 1),
  userId: 'audit',
  name: 'Fluxo',
  mode: 'offline',
  now: Date.parse('2026-01-15T15:00:00Z'),
});
if (!created.ok) throw new Error(created.error.message);
const state = created.value;
const totals = {
  games: 120,
  goals: 0,
  shots: 0,
  passes: 0,
  long: 0,
  crosses: 0,
  returns: 0,
  corners: 0,
  unmarkedBlocks: 0,
  pendingRestarts: 0,
};
const started = performance.now();
for (let seed = 0; seed < totals.games; seed++) {
  const fixture = state.fixtures[seed % state.fixtures.length]!;
  const home = state.clubs.byId[fixture.homeId]!;
  const away = state.clubs.byId[fixture.awayId]!;
  const game = simulateMatch(
    fixture,
    resolveLineup(state, home, state.lastProcessedAt).flatMap((slot) =>
      slot.player ? [{ ...slot.player, position: slot.position }] : [],
    ),
    resolveLineup(state, away, state.lastProcessedAt).flatMap((slot) =>
      slot.player ? [{ ...slot.player, position: slot.position }] : [],
    ),
    state.stadiums.byId[home.stadiumId]!,
    seed,
  );
  totals.goals += game.homeGoals + game.awayGoals;
  const actions = game.actions ?? [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    if (action.type === 'shot') {
      totals.shots++;
      if (action.outcome === 'blocked' && !action.interceptorId) totals.unmarkedBlocks++;
    }
    if (action.type === 'corner') totals.corners++;
    if (action.type === 'cross') totals.crosses++;
    if (action.type === 'pass') {
      totals.passes++;
      if (
        Math.hypot((action.endX ?? action.x) - action.x, (action.endZ ?? action.z) - action.z) > 25
      )
        totals.long++;
      const previous = actions[i - 1];
      if (
        previous?.type === 'pass' &&
        previous.playerId === action.targetId &&
        previous.targetId === action.playerId
      )
        totals.returns++;
    }
    if (action.type === 'penalty' || action.type === 'free-kick') {
      if (
        !actions
          .slice(i + 1)
          .some(
            (next) => next.side === action.side && ['shot', 'pass', 'cross'].includes(next.type),
          )
      ) {
        totals.pendingRestarts++;
        if (process.env.AUDIT_VERBOSE && totals.pendingRestarts <= 2)
          process.stdout.write(
            JSON.stringify(
              actions.slice(-12).map((a) => ({
                t: a.type,
                minute: a.minute,
                side: a.side,
                setPiece: a.setPiece,
                x: a.x,
                z: a.z,
              })),
            ) + '\n',
          );
      }
    }
  }
}
process.stdout.write(
  JSON.stringify({ ...totals, milliseconds: Math.round(performance.now() - started) }) + '\n',
);
