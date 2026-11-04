import fs from 'node:fs';
import { simulateMatch } from '../packages/domain/dist/index.js';
import { FORMATIONS } from '../packages/shared/dist/index.js';
const db = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
const template = Object.values(db.players.byId)[0],
  stadium = Object.values(db.stadiums.byId)[0];
const squad = (shape, side) =>
  FORMATIONS[shape].map((slot, i) => ({
    ...template,
    id: side + '-' + i,
    clubId: side,
    position: slot.position,
    overall: 70,
    fitness: 100,
    morale: 80,
  }));
const rows = [];
for (const shape of ['4-4-2', '4-3-1-2', '3-2-4-1']) {
  let w = 0,
    d = 0,
    l = 0;
  for (let i = 0; i < 300; i++) {
    const home = i % 2 === 0;
    const left = squad(shape, 'left'),
      right = squad('4-3-3', 'right');
    const r = simulateMatch(
      {
        id: 'shape-' + i,
        competitionId: 'audit',
        round: 0,
        homeId: home ? 'left' : 'right',
        awayId: home ? 'right' : 'left',
        scheduledAt: Date.UTC(2026, 0, 1),
        neutral: true,
      },
      home ? left : right,
      home ? right : left,
      stadium,
      123456,
    );
    const diff = (r.homeGoals - r.awayGoals) * (home ? 1 : -1);
    if (diff > 0) w++;
    else if (diff < 0) l++;
    else d++;
  }
  rows.push({
    formation: shape,
    opponent: '4-3-3',
    matches: 300,
    wins: w,
    draws: d,
    losses: l,
    winRate: w / 3,
    drawRate: d / 3,
    lossRate: l / 3,
  });
}
fs.writeFileSync('tmp/strength-analysis/formation-bias.json', JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows));
