import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const seeds = (process.env.CALIBRATION_SEEDS ?? '20261026,20261027,20261028')
  .split(',')
  .map(Number);
const runs = [];
for (const seed of seeds) {
  execFileSync(process.execPath, ['scripts/simulate-brasileirao.mjs'], {
    env: { ...process.env, SIMULATION_SEED: String(seed) },
    stdio: 'ignore',
  });
  const run = JSON.parse(fs.readFileSync('docs/brasileirao-simulation.json', 'utf8'));
  runs.push(run);
  console.log(seed, JSON.stringify(run.summary));
}
const matches = runs.reduce((s, r) => s + r.summary.matches, 0);
const homeWins = runs.reduce((s, r) => s + r.summary.home.wins, 0);
const draws = runs.reduce((s, r) => s + r.summary.home.draws, 0);
const awayWins = matches - homeWins - draws;
const goals = runs.reduce((s, r) => s + r.summary.goals, 0);
const summary = {
  seasons: runs.length,
  matches,
  homeWins,
  draws,
  awayWins,
  homeWinRate: (homeWins / matches) * 100,
  drawRate: (draws / matches) * 100,
  awayWinRate: (awayWins / matches) * 100,
  goalsPerMatch: goals / matches,
};
fs.writeFileSync(
  'docs/brasileirao-calibration.json',
  JSON.stringify({ summary, seeds, runs }, null, 2),
);
console.log('AGGREGATE', JSON.stringify(summary));
