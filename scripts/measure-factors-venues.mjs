import fs from 'node:fs';
import { simulateMatch } from '../packages/domain/dist/index.js';
import { tacticalBonus } from '../packages/domain/dist/game/management.js';
import { lineupTacticalBonus, positionFactor } from '../packages/domain/dist/game/tactics.js';
import { FORMATIONS, TACTICS } from '../packages/shared/dist/index.js';
const db = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
const template = Object.values(db.players.byId)[0];
const club = Object.values(db.clubs.byId).find((c) => c.name === 'Atlético-MG');
const stadium = db.stadiums.byId[club.stadiumId],
  capacity = stadium.sectors.reduce((s, v) => s + v.capacity, 0),
  occupancy = 0.72;
const base = {
  shape: '4-3-3',
  style: 'balanced',
  chemistry: 50,
  buff: 0,
  boost: 0,
  individual: 0,
  fitness: 100,
  morale: 80,
};
const cases = [
  ['Referência: times iguais', {}],
  ['Buff +1 no time', { buff: 1 }],
  ['Debuff -1 no time', { buff: -1 }],
  ['Buff +3 no time', { buff: 3 }],
  ['Buff +1 em um atacante', { individual: 1 }],
  ['Atacante com +10 de overall', { individual: 10 }],
  ['Goleiro com +10 de overall', { individual: 10, keeper: true }],
  ['Elenco inteiro com +5 de overall', { boost: 5 }],
  ['Entrosamento 100% contra 50%', { chemistry: 100 }],
  ['Entrosamento 0% contra 50%', { chemistry: 0 }],
  ['Um zagueiro improvisado de atacante', { wrong: true }],
  ['Estratégia pelas pontas contra equilibrada', { style: 'wings' }],
  ['Estratégia equilibrada contra pelas pontas', {}, { style: 'wings' }],
  ['4-3-1-2 contra 4-3-3', { shape: '4-3-1-2' }],
  ['4-4-2 contra 4-3-3', { shape: '4-4-2' }],
  ['Condição 80 contra 100', { fitness: 80 }],
  ['Moral 60 contra 80', { morale: 60 }],
];
cases.push(
  [
    'Combo: 5-3-2 contra-ataque vs 4-3-3 posse',
    { shape: '5-3-2', style: 'counter' },
    { style: 'possession' },
  ],
  [
    'Combo: 5-4-1 bloco baixo vs 4-3-3 pressão',
    { shape: '5-4-1', style: 'low-block' },
    { style: 'gegenpress' },
  ],
  ['Combo: 4-2-3-1 posse vs 4-3-3 equilibrado', { shape: '4-2-3-1', style: 'possession' }],
);
const prepare = (config, opponent, side) => {
  const raw = FORMATIONS[config.shape].map((slot, i) => {
    const boosted = config.keeper
      ? slot.position === 'GK'
      : i === FORMATIONS[config.shape].length - 1;
    const overall = 70 + config.boost + (boosted ? config.individual : 0);
    const factor = config.wrong && boosted ? positionFactor('CB', slot.position) : 1;
    const effective = Math.max(
      1,
      Math.floor(
        (overall + config.buff) *
          factor *
          (TACTICS.chemistryBase + ((1 - TACTICS.chemistryBase) * config.chemistry) / 100),
      ),
    );
    return {
      ...template,
      id: side + '-' + i,
      clubId: side,
      position: slot.position,
      overall: effective,
      fitness: config.fitness,
      morale: config.morale,
    };
  });
  const chemistry = lineupTacticalBonus(
    raw.map((player) => ({ player, chemistry: config.chemistry })),
  );
  const tactics = tacticalBonus(config.style, config.shape, opponent.style, opponent.shape, raw);
  return raw.map((p) => ({
    ...p,
    overall: Math.max(1, Math.min(99, p.overall + chemistry + tactics)),
  }));
};

const count = 1000,
  rows = [];
fs.writeFileSync('tmp/fatores-mando-progresso.txt', '');
for (const venue of ['home', 'away', 'neutral'])
  for (const [label, change, other = {}] of cases) {
    const config = { ...base, ...change },
      opponent = { ...base, ...other };
    const our = prepare(config, opponent, 'our'),
      their = prepare(opponent, config, 'their');
    let w = 0,
      d = 0,
      l = 0,
      gf = 0,
      ga = 0;
    for (let i = 0; i < count; i++) {
      const home = venue === 'home' || (venue === 'neutral' && i % 2 === 0);
      const fixture = {
        id: 'factor-venue-' + i,
        competitionId: 'audit',
        round: 0,
        homeId: home ? 'our' : 'their',
        awayId: home ? 'their' : 'our',
        scheduledAt: Date.UTC(2026, 0, 1),
        neutral: venue === 'neutral',
      };
      const r = simulateMatch(
        fixture,
        home ? our : their,
        home ? their : our,
        stadium,
        20261104,
        undefined,
        { attendance: Math.floor(capacity * occupancy), occupancy, revenue: 0, priceCents: 100 },
        { home: home ? config.style : opponent.style, away: home ? opponent.style : config.style },
        { scenarioOnlyScheduledDismissals: true },
      );
      const a = home ? r.homeGoals : r.awayGoals,
        b = home ? r.awayGoals : r.homeGoals;
      gf += a;
      ga += b;
      if (a > b) w++;
      else if (a < b) l++;
      else d++;
      if (r.actions.some((a) => a.type === 'red')) throw Error('Unexpected red card');
    }
    const row = {
      venue,
      label,
      config,
      opponent,
      matches: count,
      wins: w,
      draws: d,
      losses: l,
      winRate: (w / count) * 100,
      drawRate: (d / count) * 100,
      lossRate: (l / count) * 100,
      goalsFor: gf / count,
      goalsAgainst: ga / count,
      effectiveAverage: our.reduce((s, p) => s + p.overall, 0) / 11,
    };
    rows.push(row);
    const reference = rows.find((r) => r.venue === venue && r.label === cases[0][0]);
    row.winRateChange = row.winRate - reference.winRate;
    fs.appendFileSync(
      'tmp/fatores-mando-progresso.txt',
      rows.length + '/' + cases.length * 3 + ' ' + venue + ' ' + label + '\n',
    );
  }
const report = {
  conditions: {
    overall: 70,
    chemistry: 50,
    morale: 80,
    fitness: 100,
    formation: '4-3-3',
    style: 'balanced',
    capacity,
    occupancy,
    matchesPerScenario: count,
    totalMatches: rows.length * count,
    scenarios: rows.length,
    seed: 20261104,
    discipline: 'No expulsions, to isolate other effects; audit flag only, not normal gameplay',
    method:
      'One factor changed at a time except explicitly named tactical combinations. Neutral alternates administrative home side. Same 1000 seeds for each scenario. Buff/debuff equivalent applied to overall before position/chemistry; does not measure activation or duration. No bench substitutions or between-match progression.',
  },
  rows,
};
fs.writeFileSync('docs/fatores-casa-fora-neutro.json', JSON.stringify(report, null, 2));
const f = (n, d = 1) => n.toFixed(d).replace('.', ',');
const lines = [
  '# Buffs, debuffs, elenco e táticas por mando',
  '',
  'Motor local atual, inclusive os ajustes de expulsão ainda não publicados. Para isolar os demais fatores, este ensaio não permite expulsões espontâneas. Times base de overall 70, entrosamento 50%, moral 80 e condição 100, em 4-3-3 equilibrado. Mesmo estádio, capacidade ' +
    capacity +
    ' e ocupação de 72%; no neutro a vantagem de mando é removida. Mil jogos por cenário, ' +
    rows.length +
    ' cenários e ' +
    rows.length * count +
    ' partidas.',
  '',
  'Todos os percentuais são do time observado. Diferença na vitória calculada contra times iguais no mesmo mando. Um fator por vez, exceto as combinações táticas identificadas. Buff/debuff aplicado como variação equivalente de overall, sem simular aquisição ou duração. Elenco natural adequado a cada formação, exceto improvisação explicitada. Sem banco, gestão humana ou evolução entre partidas. São estimativas amostrais, não percentuais universais nem pesos somáveis. Valores pequenos de poucos pontos percentuais podem depender da amostra. O protocolo de estádio e disciplina difere do primeiro ensaio em campo neutro; os números não são uma comparação direta antes/depois.',
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
    '| Alteração no time observado | Vitória | Empate | Derrota | Diferença na vitória | Gols marcados/jogo | Gols sofridos/jogo |',
    '|---|---:|---:|---:|---:|---:|---:|',
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
            (r.winRateChange >= 0 ? '+' : '') + f(r.winRateChange) + ' p.p.',
            f(r.goalsFor, 2),
            f(r.goalsAgainst, 2),
          ].join(' | ') +
          ' |',
      ),
    '',
  );
}
lines.push(
  '## Comparação direta do mando',
  '',
  '| Cenário | Vitória casa | Vitória fora | Vitória neutro | Casa menos fora |',
  '|---|---:|---:|---:|---:|',
);
for (const [label] of cases) {
  const h = rows.find((r) => r.venue === 'home' && r.label === label),
    a = rows.find((r) => r.venue === 'away' && r.label === label),
    n = rows.find((r) => r.venue === 'neutral' && r.label === label);
  lines.push(
    '| ' +
      [
        label,
        f(h.winRate) + '%',
        f(a.winRate) + '%',
        f(n.winRate) + '%',
        f(h.winRate - a.winRate) + ' p.p.',
      ].join(' | ') +
      ' |',
  );
}
lines.push(
  '',
  'A média do time é derivada dos jogadores. Buffs/debuffs, tática, entrosamento e overall usam canais sobrepostos e não devem ter suas diferenças somadas. A vantagem estrutural de certas formações ainda está pendente de ajuste.',
);
fs.writeFileSync('docs/fatores-casa-fora-neutro.md', lines.join('\n'));
console.log(JSON.stringify(report));
