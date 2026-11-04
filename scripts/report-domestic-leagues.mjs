import fs from 'node:fs';
const label = process.env.SIMULATION_LABEL ?? '';
const prefix = 'docs/simulacao-' + (label ? label + '-' : '');
const reports = ['a', 'b', 'c', 'd'].map((d) =>
  JSON.parse(fs.readFileSync(prefix + 'serie-' + d + '.json', 'utf8')),
);
const n = (v, d = 1) => v.toFixed(d).replace('.', ',');
const pct = (v) => n(v) + '%';
const headings = [
  '# Simulação das Séries A, B, C e D' + (label ? ' — proposta experimental' : ' — motor atual'),
  '',
  'Uma temporada por divisão, semente 20261026. ' +
    (label
      ? 'Proposta experimental: força coletiva e individual ampliadas; removido bloqueio automático por overall nas janelas FIFA; ajuste ofensivo ao buscar ou preservar resultado. Não aplicada ao jogo.'
      : 'Motor atual com alterações locais já aplicadas; protótipos do relatório de força não estão ativos.') +
    ' Pontos corridos em turno e returno: 20 clubes em A/B/C (38 jogos por clube) e os 25 clubes disponíveis em D (48 jogos por clube). C e D não reproduzem o regulamento real. Sem copas, transferências ou decisões humanas. Bots com formação inicial escolhida pelo encaixe e estilo adaptativo. Buffs/debuffs, qualidade individual, desgaste, lesões, treino e entrosamento de 50% ativos.' +
    (label
      ? ' Neste cenário experimental, as janelas FIFA não bloqueiam jogadores automaticamente por overall.'
      : ' Janelas FIFA mantêm a regra atual de indisponibilidade automática por overall.') +
    '',
  '',
  'Média elenco: média aritmética do overall inicial de todos os jogadores vinculados, inclusive reservas. Média XI: média inicial dos titulares escolhidos, antes dos ajustes de posição/entrosamento. As médias não são recalculadas depois da evolução durante a temporada. Uma execução não é previsão nem média de várias temporadas.',
  '',
  '## Resumo',
  '',
  '| Série | Clubes | Jogos | Vitória mandante | Empate | Vitória visitante | Gols/jogo | Campeão |',
  '|---|---:|---:|---:|---:|---:|---:|---|',
  ...reports.map(
    (r) =>
      '| ' +
      [
        r.summary.division,
        r.summary.clubs,
        r.summary.matches,
        pct(r.summary.home.winRate),
        pct(r.summary.home.drawRate),
        pct(r.summary.away.winRate),
        n(r.summary.goalsPerMatch, 2),
        r.table[0].name,
      ].join(' | ') +
      ' |',
  ),
];
const all = [...headings];
for (const r of reports) {
  const lines = [
    '# Série ' + r.summary.division,
    '',
    '## Classificação',
    '',
    '| Pos. | Clube | Média elenco | Média XI | J | Pts | V | E | D | GP | GC | SG | Formação inicial |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
    ...r.table.map(
      (c) =>
        '| ' +
        [
          c.rank,
          c.name,
          n(c.squadAverage),
          n(c.initialStrength.raw),
          c.played,
          c.points,
          c.wins,
          c.draws,
          c.losses,
          c.goalsFor,
          c.goalsAgainst,
          c.goalDifference,
          c.formation,
        ].join(' | ') +
        ' |',
    ),
    '',
    '## Desempenho por clube',
    '',
    'V/E/D apresentados nesta ordem. Percentuais calculados por participação do clube; todos têm a mesma quantidade de jogos dentro da divisão.',
    '',
    '| Clube | V/E/D geral | V/E/D casa | V/E/D fora | Taxas gerais V/E/D | Taxas em casa V/E/D | Taxas fora V/E/D |',
    '|---|---|---|---|---|---|---|',
    ...r.table.map(
      (c) =>
        '| ' +
        [
          c.name,
          ...[c.overall, c.home, c.away].map((s) => [s.wins, s.draws, s.losses].join('/')),
          ...[c.overall, c.home, c.away].map((s) =>
            [pct(s.winRate), pct(s.drawRate), pct(s.lossRate)].join(' / '),
          ),
        ].join(' | ') +
        ' |',
    ),
    '',
    '## Taxas da divisão',
    '',
    '| Condição | Vitória | Empate | Derrota |',
    '|---|---:|---:|---:|',
    ...[
      [r.summary.overall, 'Geral por clube'],
      [r.summary.home, 'Mandante'],
      [r.summary.away, 'Visitante'],
    ].map(
      ([s, label]) =>
        '| ' + [label, pct(s.winRate), pct(s.drawRate), pct(s.lossRate)].join(' | ') + ' |',
    ),
  ];
  fs.writeFileSync(
    prefix + 'serie-' + r.summary.division.toLowerCase() + '.md',
    headings.slice(0, 6).join('\n') + '\n\n' + lines.join('\n'),
  );
  all.push('', ...lines.map((l) => (l.startsWith('# ') ? '#' + l : l)));
}
fs.writeFileSync(prefix + 'ligas-a-b-c-d.md', all.join('\n'));
fs.writeFileSync(
  prefix + 'ligas-a-b-c-d.json',
  JSON.stringify(
    {
      settings: JSON.parse(fs.readFileSync('packages/shared/src/config/gameplay.json', 'utf8')),
      reports,
    },
    null,
    2,
  ),
);
for (const r of reports) {
  if (
    r.table.length !== r.summary.clubs ||
    r.table.some((c) => c.played !== (r.summary.clubs - 1) * 2) ||
    r.table.reduce((s, c) => s + c.goalsFor, 0) !== r.summary.goals ||
    r.table.reduce((s, c) => s + c.wins, 0) !== r.table.reduce((s, c) => s + c.losses, 0)
  )
    throw Error('Invalid totals');
  console.log(
    JSON.stringify({
      division: r.summary.division,
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
    }),
  );
}
