import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const reports = [];
for (const seed of [20261104, 20261105, 20261106]) {
  execFileSync(process.execPath, ['scripts/simulate-domestic-league.mjs'], {
    env: {
      ...process.env,
      SIMULATION_DIVISION: 'A',
      SIMULATION_LABEL: 'tres-brasileiroes',
      SIMULATION_SEED: String(seed),
    },
    stdio: 'ignore',
  });
  const r = JSON.parse(fs.readFileSync('docs/simulacao-tres-brasileiroes-serie-a.json', 'utf8'));
  reports.push(r);
  console.log('Temporada concluída: ' + seed);
}
fs.writeFileSync(
  'docs/tres-brasileiroes-serie-a.json',
  JSON.stringify(
    {
      scenario:
        'Experimental squad-strength proposal; three independent seasons from the same initial dataset, not consecutive career years',
      seeds: [20261104, 20261105, 20261106],
      reports,
    },
    null,
    2,
  ),
);
const n = (v, d = 1) => v.toFixed(d).replace('.', ',');
const lines = [
  '# Três Brasileirões — Série A',
  '',
  'Proposta experimental de maior peso do elenco, sem bloqueio automático por overall nas janelas FIFA. Três temporadas independentes, iniciadas com a mesma base, e sementes distintas. Não são anos consecutivos de uma carreira. Cada temporada tem 380 partidas, 38 jogos por clube (19 em casa e 19 fora). Sem copas, transferências ou gestão humana. Média elenco: overall inicial de todos os jogadores vinculados, incluindo reservas. Buffs/debuffs, entrosamento, formação, estilo adaptativo, desgaste, lesões e progressão do motor ativos. A vantagem de certas formações identificada na análise anterior permanece. Não é previsão do futebol real nem mudança publicada.',
  '',
];
for (let i = 0; i < reports.length; i++) {
  const r = reports[i];
  lines.push(
    '## Brasileirão ' + (i + 1),
    '',
    '| Pos. | Clube | Média elenco | Pts | V | E | D | GP | GC | SG |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...r.table.map(
      (c) =>
        '| ' +
        [
          c.rank,
          c.name,
          n(c.squadAverage),
          c.points,
          c.wins,
          c.draws,
          c.losses,
          c.goalsFor,
          c.goalsAgainst,
          c.goalDifference,
        ].join(' | ') +
        ' |',
    ),
    '',
    '| Condição | Vitórias | Empates | Derrotas |',
    '|---|---:|---:|---:|',
    ...[
      [r.summary.overall, 'Geral por clube'],
      [r.summary.home, 'Em casa'],
      [r.summary.away, 'Fora'],
    ].map(
      ([s, l]) =>
        '| ' + [l, n(s.winRate) + '%', n(s.drawRate) + '%', n(s.lossRate) + '%'].join(' | ') + ' |',
    ),
    '',
    'Gols por jogo: ' + n(r.summary.goalsPerMatch, 2) + '.',
    '',
    '### Por mando de campo',
    '',
    '| Clube | V/E/D casa | V/E/D fora | Taxas casa V/E/D | Taxas fora V/E/D |',
    '|---|---|---|---|---|',
    ...r.table.map(
      (c) =>
        '| ' +
        [
          c.name,
          ...[c.home, c.away].map((s) => [s.wins, s.draws, s.losses].join('/')),
          ...[c.home, c.away].map((s) =>
            [s.winRate, s.drawRate, s.lossRate].map((v) => n(v) + '%').join(' / '),
          ),
        ].join(' | ') +
        ' |',
    ),
    '',
  );
  if (
    r.summary.matches !== 380 ||
    r.table.some((c) => c.played !== 38 || c.home.games !== 19 || c.away.games !== 19)
  )
    throw Error('Invalid season');
}
const totals = {
  matches: 1140,
  homeWins: reports.reduce((s, r) => s + r.summary.home.wins, 0),
  draws: reports.reduce((s, r) => s + r.summary.home.draws, 0),
  awayWins: reports.reduce((s, r) => s + r.summary.away.wins, 0),
  goals: reports.reduce((s, r) => s + r.summary.goals, 0),
};
lines.push(
  '## Resumo conjunto',
  '',
  '| Indicador | Resultado |',
  '|---|---:|',
  '| Vitórias mandantes | ' + n(totals.homeWins / 11.4) + '% |',
  '| Empates | ' + n(totals.draws / 11.4) + '% |',
  '| Vitórias visitantes | ' + n(totals.awayWins / 11.4) + '% |',
  '| Gols por jogo | ' + n(totals.goals / 1140, 2) + ' |',
);
fs.writeFileSync('docs/tres-brasileiroes-serie-a.md', lines.join('\n'));
console.log(
  JSON.stringify({
    totals,
    seasons: reports.map((r) => ({
      summary: r.summary,
      table: r.table.map((c) => ({
        rank: c.rank,
        name: c.name,
        average: n(c.squadAverage),
        pts: c.points,
        w: c.wins,
        d: c.draws,
        l: c.losses,
      })),
    })),
  }),
);
