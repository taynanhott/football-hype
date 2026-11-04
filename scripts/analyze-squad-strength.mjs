import fs from 'node:fs';
import { simulateMatch } from '../packages/domain/dist/index.js';
const db = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
const template = Object.values(db.players.byId)[0];
const stadium = Object.values(db.stadiums.byId)[0];
const positions = ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];
const squad = (overall, side) =>
  positions.map((position, i) => ({
    ...template,
    id: side + '-' + i,
    clubId: side,
    position,
    overall,
    fitness: 100,
    morale: 80,
  }));
const scenarios = [];
const count = 500;
for (const gap of [0, 5, 10, 15]) {
  let w = 0,
    d = 0,
    l = 0,
    gf = 0,
    ga = 0;
  for (let i = 0; i < count; i++) {
    const home = i % 2 === 0;
    const strong = squad(70 + gap, 'strong');
    const weak = squad(70, 'weak');
    const fixture = {
      id: 'quality-' + i,
      competitionId: 'audit',
      round: 0,
      homeId: home ? 'strong' : 'weak',
      awayId: home ? 'weak' : 'strong',
      scheduledAt: Date.UTC(2026, 0, 1),
      neutral: true,
    };
    const result = simulateMatch(
      fixture,
      home ? strong : weak,
      home ? weak : strong,
      stadium,
      123456,
    );
    const a = home ? result.homeGoals : result.awayGoals,
      b = home ? result.awayGoals : result.homeGoals;
    gf += a;
    ga += b;
    if (a > b) w++;
    else if (a < b) l++;
    else d++;
  }
  scenarios.push({
    gap,
    matches: count,
    wins: w,
    draws: d,
    losses: l,
    winRate: (w / count) * 100,
    drawRate: (d / count) * 100,
    lossRate: (l / count) * 100,
    goalsFor: gf / count,
    goalsAgainst: ga / count,
    pointsPerGame: (w * 3 + d) / count,
  });
}
fs.writeFileSync(
  process.env.STRENGTH_OUTPUT ?? 'tmp/strength-analysis/current-duels.json',
  JSON.stringify(scenarios, null, 2),
);
console.log(JSON.stringify(scenarios));
