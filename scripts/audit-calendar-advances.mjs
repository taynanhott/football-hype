import fs from 'node:fs';
import {
  createWorld,
  importDataset,
  pendingFixtures,
  scheduledFixtures,
  playNextBatch,
} from '../packages/domain/dist/index.js';
const unwrap = (r) => {
  if (!r.ok) throw Error(JSON.stringify(r.error));
  return r.value;
};
let state = unwrap(
  importDataset(
    unwrap(
      createWorld({
        id: '00000001-0000-4000-8000-000000000001',
        userId: 'calendar-audit',
        name: 'Calendar audit',
        mode: 'multiplayer',
        now: Date.parse('2026-11-04T14:00:00-03:00'),
      }),
    ),
    JSON.parse(fs.readFileSync('data/player-database.json', 'utf8')),
  ),
);
const issues = [];
for (let i = 0; i < 35; i++) {
  const first = pendingFixtures(state)[0];
  if (!first) break;
  const previous = state.lastProcessedAt;
  const old = new Set(state.results.map((r) => r.fixtureId));
  state = unwrap(playNextBatch(state, Date.parse('2026-11-04T14:00:00-03:00') + i * 120000));
  const fresh = state.results.filter((r) => !old.has(r.fixtureId));
  const dates = new Map(scheduledFixtures(state).map((f) => [f.id, f.scheduledAt]));
  const latest = Math.max(...fresh.map((r) => dates.get(r.fixtureId) ?? 0));
  if (latest > state.lastProcessedAt || state.lastProcessedAt < previous)
    issues.push({
      step: i + 1,
      initial: new Date(first.scheduledAt).toISOString(),
      latest: new Date(latest).toISOString(),
      clock: new Date(state.lastProcessedAt).toISOString(),
      fixtures: fresh.map((r) => r.fixtureId),
    });
  console.log(
    JSON.stringify({
      step: i + 1,
      day: new Date(state.lastProcessedAt).toISOString(),
      latest: new Date(latest).toISOString(),
      matches: fresh.length,
    }),
  );
  if (state.lastProcessedAt > Date.UTC(2026, 2, 1)) break;
}
fs.writeFileSync('tmp/calendar-advance-audit.json', JSON.stringify(issues, null, 2));
console.log('ISSUES', JSON.stringify(issues));
