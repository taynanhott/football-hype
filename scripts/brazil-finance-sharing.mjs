import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync('docs/monthly-finance-scenarios.json', 'utf8'));
const result = [];
for (const division of ['A', 'B', 'C', 'D']) {
  const clubs = report.rows.filter((c) => c.country === 'BR' && c.division === division);
  const scenarios = clubs.map((club) => {
    const cases = club.scenarios.map((s) => ({ ...s, retained: s.net - s.ticketIncome * 0.3 }));
    return {
      club,
      low: cases.reduce((a, b) => (a.retained < b.retained ? a : b)),
      high: cases.reduce((a, b) => (a.retained > b.retained ? a : b)),
      normal: cases.filter((s) => s.tier === 'Normal'),
    };
  });
  for (const item of scenarios) {
    const others = scenarios.filter((s) => s !== item);
    const avg = (fn) => others.reduce((sum, s) => sum + fn(s), 0) / others.length;
    result.push({
      division,
      name: item.club.name,
      maintenance: item.club.infra,
      sponsorship: item.club.sponsor,
      pessimistic: Math.round(item.low.retained + avg((s) => s.low.ticketIncome) * 0.3),
      medium: Math.round(
        item.normal.reduce((sum, s) => sum + s.retained, 0) / item.normal.length +
          avg((s) => s.normal.reduce((sum, n) => sum + n.ticketIncome, 0) / s.normal.length) * 0.3,
      ),
      optimistic: Math.round(item.high.retained + avg((s) => s.high.ticketIncome) * 0.3),
    });
  }
}
const money = (n) => n.toLocaleString('pt-BR');
const lines = [
  '# Resultado mensal previsto por clube',
  '',
  'Valores em HC$. Dois jogos em casa e dois fora, quatro patrocínios mensais. Bilheteria simulada: 70% mandante e 30% visitante; comércio do mandante. Adversários pela média dos outros clubes da divisão. Médio: ingresso Normal e média das procuras 85% e 108%; extremos: menor e maior resultado. Inclui salários e manutenção. Exclui obras, transferências e premiações. Contratos baseados em margem de 15% das despesas iniciais com procura de referência, sem garantia de lucro. A regra 70/30 está aplicada no código local; publicação pendente.',
  '',
];
for (const division of ['A', 'B', 'C', 'D']) {
  lines.push(
    '## Série ' + division,
    '',
    '| Clube | Manutenção | Patrocínio mensal | Pessimista | Médio | Otimista |',
    '|---|---:|---:|---:|---:|---:|',
  );
  for (const c of result
    .filter((c) => c.division === division)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
    lines.push(
      '| ' +
        [
          c.name,
          money(c.maintenance),
          money(c.sponsorship),
          money(c.pessimistic),
          money(c.medium),
          money(c.optimistic),
        ].join(' | ') +
        ' |',
    );
  lines.push('');
}
fs.writeFileSync('docs/lucro-mensal-brasileirao-70-30.md', lines.join('\n'));
fs.writeFileSync('docs/lucro-mensal-brasileirao.md', lines.join('\n'));
console.log(
  JSON.stringify(
    result.filter((c) =>
      ['Atlético-MG', 'Flamengo', 'Corinthians', 'Paysandu', 'CSA'].includes(c.name),
    ),
  ),
);
for (const d of ['A', 'B', 'C', 'D']) {
  const rows = result.filter((c) => c.division === d);
  console.log(
    d,
    JSON.stringify({
      negativeMedium: rows.filter((c) => c.medium < 0).length,
      average: Math.round(rows.reduce((sum, c) => sum + c.medium, 0) / rows.length),
    }),
  );
}
