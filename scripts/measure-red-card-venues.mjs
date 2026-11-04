import fs from 'node:fs';
import { simulateMatch } from '../packages/domain/dist/index.js';
import { FORMATIONS } from '../packages/shared/dist/index.js';
const db = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
const template = Object.values(db.players.byId)[0];
const club = Object.values(db.clubs.byId).find((c) => c.name === 'Atlético-MG');
const stadium = db.stadiums.byId[club.stadiumId];
const capacity = stadium.sectors.reduce((sum, s) => sum + s.capacity, 0);
const occupancy = 0.72;
const squad = (side) =>
  FORMATIONS['4-3-3'].map((slot, i) => ({
    ...template,
    id: side + '-' + i,
    clubId: side,
    position: slot.position,
    overall: 70,
    fitness: 100,
    morale: 80,
  }));
const cases = [
  { label: 'Sem expulsão', times: [] },
  ...[0, 30, 60, 80].flatMap((minute) => [
    { label: '1 aos ' + minute + ' min', times: [minute] },
    { label: '2 aos ' + minute + ' min', times: [minute, minute] },
  ]),
  { label: '1 aos 30 + 1 aos 60', times: [30, 60] },
];
const rows = [];
const count = 1000;
for (const venue of ['home', 'away', 'neutral'])
  for (const scenario of cases) {
    let w = 0,
      d = 0,
      l = 0,
      gf = 0,
      ga = 0;
    for (let i = 0; i < count; i++) {
      const home = venue === 'home' || (venue === 'neutral' && i % 2 === 0);
      const own = squad('own'),
        other = squad('other');
      const midfielder = own.find((p) => p.position === 'DM') ?? own[5];
      const defender = own.find((p) => p.position === 'CB');
      const dismissed = [midfielder, defender];
      const side = home ? 'home' : 'away';
      const fixture = {
        id: 'red-venue-' + i,
        competitionId: 'audit',
        round: 0,
        homeId: home ? 'own' : 'other',
        awayId: home ? 'other' : 'own',
        scheduledAt: Date.UTC(2026, 0, 1),
        neutral: venue === 'neutral',
      };
      const result = simulateMatch(
        fixture,
        home ? own : other,
        home ? other : own,
        stadium,
        20261104,
        undefined,
        { attendance: Math.floor(capacity * occupancy), occupancy, revenue: 0, priceCents: 100 },
        undefined,
        {
          scenarioOnlyScheduledDismissals: true,
          scenarioDismissals: scenario.times.map((minute, j) => ({
            side,
            playerId: dismissed[j].id,
            minute,
          })),
        },
      );
      const a = home ? result.homeGoals : result.awayGoals,
        b = home ? result.awayGoals : result.homeGoals;
      gf += a;
      ga += b;
      if (a > b) w++;
      else if (a < b) l++;
      else d++;
      const reds = (result.actions ?? []).filter((a) => a.type === 'red');
      if (reds.length !== scenario.times.length || reds.some((a) => a.side !== side))
        throw Error('Unexpected dismissals');
      for (let j = 0; j < scenario.times.length; j++)
        if (result.minutesPlayed[dismissed[j].id] !== scenario.times[j])
          throw Error('Invalid dismissed minutes');
    }
    const row = {
      venue,
      label: scenario.label,
      times: scenario.times,
      matches: count,
      wins: w,
      draws: d,
      losses: l,
      winRate: (w / count) * 100,
      drawRate: (d / count) * 100,
      lossRate: (l / count) * 100,
      goalsFor: gf / count,
      goalsAgainst: ga / count,
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
const report = {
  conditions: {
    overall: 70,
    formation: '4-3-3',
    morale: 80,
    fitness: 100,
    capacity,
    occupancy,
    stadium: 'Same Atlético-MG stadium for all venues; neutral removes only venue advantage',
    matchesPerScenario: count,
    scenarios: rows.length,
    totalMatches: rows.length * count,
    seed: 20261104,
    expulsions:
      'First a midfielder, then a centre-back; simultaneous unless explicitly staggered; spontaneous dismissals disabled only in the audit; no bench or human interventions',
  },
  rows,
};
fs.writeFileSync('docs/expulsoes-casa-fora-neutro.json', JSON.stringify(report, null, 2));
const f = (n, d = 1) => n.toFixed(d).replace('.', ',');
const lines = [
  '# Expulsões: casa, fora e campo neutro',
  '',
  'Times equivalentes de overall 70, moral 80 e condição 100, em 4-3-3. Mesmo estádio em todos os casos, capacidade ' +
    capacity +
    ' e ocupação de 72%. Mil jogos por cenário, 30 cenários e 30 mil partidas. No neutro, a identificação administrativa de mandante alterna e a vantagem de mando é removida.',
  '',
  'Todos os resultados são da perspectiva do time observado, que recebe os cartões. A primeira expulsão é de um meio-campista e a segunda de um zagueiro. Nos cenários de duas expulsões no mesmo minuto, os dois cartões são simultâneos. O cenário 30/60 é sequencial. Outras expulsões são desativadas apenas no ensaio para isolar exatamente 11x11, 10x11 e 9x11; o jogo normal mantém os cartões espontâneos. Sem substituições ou decisões humanas. São parâmetros e resultados do simulador, não estatísticas reais. Amostra finita de uma configuração específica.',
  '',
];
for (const [venue, title] of [
  ['home', 'Em casa'],
  ['away', 'Fora de casa'],
  ['neutral', 'Campo neutro'],
]) {
  lines.push(
    '## ' + title,
    '',
    '| Expulsões do time observado | Vitória | Empate | Derrota | Gols marcados/jogo | Gols sofridos/jogo |',
    '|---|---:|---:|---:|---:|---:|',
    ...rows
      .filter((r) => r.venue === venue)
      .map(
        (r) =>
          '| ' +
          [
            r.label,
            f(r.winRate) + '%',
            f(r.drawRate) + '%',
            f(r.lossRate) + '%',
            f(r.goalsFor, 2),
            f(r.goalsAgainst, 2),
          ].join(' | ') +
          ' |',
      ),
    '',
  );
}
lines.push(
  '## Efeito do mando na chance de vitória',
  '',
  'Diferenças em pontos percentuais, comparando o mesmo cenário de expulsões.',
  '',
  '| Cenário | Casa menos neutro | Fora menos neutro | Casa menos fora |',
  '|---|---:|---:|---:|',
);
for (const scenario of cases) {
  const h = rows.find((r) => r.venue === 'home' && r.label === scenario.label),
    a = rows.find((r) => r.venue === 'away' && r.label === scenario.label),
    n = rows.find((r) => r.venue === 'neutral' && r.label === scenario.label);
  lines.push(
    '| ' +
      [
        scenario.label,
        f(h.winRate - n.winRate) + ' p.p.',
        f(a.winRate - n.winRate) + ' p.p.',
        f(h.winRate - a.winRate) + ' p.p.',
      ].join(' | ') +
      ' |',
  );
}
fs.writeFileSync('docs/expulsoes-casa-fora-neutro.md', lines.join('\n'));
