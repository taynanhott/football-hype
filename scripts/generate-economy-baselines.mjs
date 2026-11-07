import fs from 'node:fs';
import { facilityCosts } from '../packages/domain/dist/finance/facility-costs.js';
import { stadiumBenefits } from '../packages/domain/dist/finance/stadium-benefits.js';
const data = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
const old = fs.readFileSync('docs/lucro-mensal-brasileirao.md', 'utf8');
const mids = new Map();
for (const line of old.split('\n')) {
  if (!line.startsWith('|') || line.includes('---') || line.includes('Clube')) continue;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((x) => x.trim());
  mids.set(cells[0], Number(cells[4].replaceAll('.', '')) * 100);
}
const targets = {
  A: [-350000, 1316500, 2429500],
  B: [-79500, 466500, 1018000],
  C: [-72000, 406000, 908500],
  D: [-69500, 415200, 809600],
  REGIONAL: [-69500, 350000, 650000],
};
const profiles = {};
for (const c of Object.values(data.clubs.byId)) {
  const stadium = data.stadiums.byId[c.stadiumId],
    center = data.centers.byId[c.trainingCenterId];
  const division = targets[c.division] ? c.division : 'A';
  const same = Object.values(data.clubs.byId).filter(
    (x) => x.country === c.country && x.division === c.division,
  );
  const avg =
    same.reduce((sum, x) => sum + (mids.get(x.name) ?? targets[division][1]), 0) / same.length;
  const ratio = (mids.get(c.name) ?? targets[division][1]) / avg;
  profiles[c.id] = {
    cost:
      c.playerIds.reduce((sum, id) => sum + data.players.byId[id].salary.cents, 0) +
      facilityCosts(data, c).reduce((sum, x) => sum + x.cost, 0),
    capacity: stadium.sectors.reduce((sum, x) => sum + x.capacity, 0),
    commerce: stadiumBenefits(stadium).commerce,
    marketing: center.levels.marketing,
    targets: [
      Math.round(targets[division][0] * ratio),
      Math.round(targets[division][1] * ratio),
      Math.round(targets[division][2] * ratio),
    ],
  };
}
fs.writeFileSync(
  'packages/domain/src/finance/economy-baselines.ts',
  '// Generated from original squads and structures; never recalculated from current spending.\nexport const ECONOMY_BASELINES: Readonly<Record<string, { cost: number; capacity: number; commerce: number; marketing: number; targets: readonly number[] }>> = ' +
    JSON.stringify(profiles) +
    ';\n',
);
