import fs from 'node:fs';
import { createWorld, stableId, sponsorshipContract } from '../packages/domain/dist/index.js';
import { ECONOMY_BASELINES } from '../packages/domain/dist/finance/economy-baselines.js';
const data = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
const seed = createWorld({
  id: stableId(843, 1),
  userId: 'host',
  name: 'Calibração',
  mode: 'offline',
  now: Date.UTC(2026, 0, 1, 3),
}).value;
const state = {
  ...seed,
  clubs: data.clubs,
  players: data.players,
  stadiums: data.stadiums,
  centers: data.centers,
  fixtures: [],
  cups: [],
  results: [],
};
const start = performance.now();
const contract = sponsorshipContract(state, '2026-01');
const elapsed = performance.now() - start;
const rows = Object.values(data.clubs.byId)
  .filter((c) => c.country === 'BR' && ['A', 'B', 'C', 'D'].includes(c.division))
  .map((c) => {
    const p = ECONOMY_BASELINES[c.id],
      s = contract.clubs[c.id];
    return {
      club: c.name,
      division: c.division,
      pessimistic: (s.low - p.cost) / 100,
      medium: (s.normal - p.cost) / 100,
      optimistic: (s.high - p.cost) / 100,
    };
  });
const lines = [
  '# Calibração econômica mensal — 07/11/2026',
  '',
  'Valores em HC$. Referência dos elencos e estruturas originais, sem premiações, compras, obras ou renovações. Contratos comerciais são fixados por mês conforme o calendário conhecido; custos de referência não aumentam quando o treinador gasta mais. Pagamentos proporcionais aos dias, com componente limitado pela fase do time. Bilheteria conserva 70/30. As metas abaixo são referências de calibração, não limites ou garantias de lucro na carreira. Mudanças de elenco, preços, público real, marketing, calendário posterior e fase ao longo do mês alteram o resultado. A calibração sem jogos abaixo isola a receita recorrente dos efeitos da bilheteria.',
  '',
  '| Divisão | Pessimista médio | Lucro médio | Otimista médio |',
  '|---|---:|---:|---:|',
];
for (const d of ['A', 'B', 'C', 'D']) {
  const rs = rows.filter((r) => r.division === d);
  const mean = (k) =>
    Math.round(rs.reduce((sum, r) => sum + r[k], 0) / rs.length).toLocaleString('pt-BR');
  lines.push(`| ${d} | ${mean('pessimistic')} | ${mean('medium')} | ${mean('optimistic')} |`);
}
for (const d of ['A', 'B', 'C', 'D']) {
  lines.push(
    '',
    `## Série ${d}`,
    '',
    '| Clube | Pessimista | Médio | Otimista |',
    '|---|---:|---:|---:|',
  );
  for (const r of rows
    .filter((r) => r.division === d)
    .sort((a, b) => a.club.localeCompare(b.club, 'pt-BR')))
    lines.push(
      `| ${r.club} | ${Math.round(r.pessimistic).toLocaleString('pt-BR')} | ${Math.round(r.medium).toLocaleString('pt-BR')} | ${Math.round(r.optimistic).toLocaleString('pt-BR')} |`,
    );
}
fs.writeFileSync('docs/calibracao-economica-mensal-2026-11-07.md', lines.join('\n') + '\n');
console.log(
  JSON.stringify({ clubs: rows.length, contractCalculationMs: Math.round(elapsed * 100) / 100 }),
);
