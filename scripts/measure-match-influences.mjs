import fs from 'node:fs';
import { simulateMatch } from '../packages/domain/dist/index.js';
import { tacticalBonus } from '../packages/domain/dist/game/management.js';
import { lineupTacticalBonus, positionFactor } from '../packages/domain/dist/game/tactics.js';
import { FORMATIONS, TACTICS } from '../packages/shared/dist/index.js';
const db = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
const template = Object.values(db.players.byId)[0],
  stadium = Object.values(db.stadiums.byId)[0];
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
const results = [];
const count = 1200;
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
    const home = i % 2 === 0;
    const fixture = {
      id: 'influence-' + Math.floor(i / 2),
      competitionId: 'audit',
      round: 0,
      homeId: home ? 'our' : 'their',
      awayId: home ? 'their' : 'our',
      scheduledAt: Date.UTC(2026, 0, 1),
      neutral: true,
    };
    const r = simulateMatch(
      fixture,
      home ? our : their,
      home ? their : our,
      stadium,
      20261104,
      undefined,
      undefined,
      { home: home ? config.style : opponent.style, away: home ? opponent.style : config.style },
    );
    const a = home ? r.homeGoals : r.awayGoals,
      b = home ? r.awayGoals : r.homeGoals;
    gf += a;
    ga += b;
    if (a > b) w++;
    else if (a < b) l++;
    else d++;
  }
  const row = {
    label,
    config,
    opponent,
    matches: count,
    independentSeeds: count / 2,
    wins: w,
    draws: d,
    losses: l,
    winRate: (w / count) * 100,
    drawRate: (d / count) * 100,
    lossRate: (l / count) * 100,
    pointsPerGame: (w * 3 + d) / count,
    goalsFor: gf / count,
    goalsAgainst: ga / count,
    effectiveAverage: our.reduce((s, p) => s + p.overall, 0) / 11,
  };
  results.push(row);
  console.log(label, JSON.stringify({ w: row.winRate, d: row.drawRate, l: row.lossRate }));
}
const reference = results[0].winRate;
for (const r of results) r.winRateChange = r.winRate - reference;
fs.writeFileSync(
  'docs/influencia-fatores-confronto.json',
  JSON.stringify(
    {
      scenario:
        'Current local engine, 70 overall, neutral, mirrored 600 seeds per case, 1200 matches per case; initial chemistry 50, morale80, fitness100; one factor changed per case; tactical modifiers reproduced before simulateMatch',
      results,
    },
    null,
    2,
  ),
);
const f = (n) => n.toFixed(1).replace('.', ',');
const lines = [
  '# Influência dos fatores em um confronto equilibrado',
  '',
  'Motor atual local. Times de overall base 70, entrosamento 50%, moral 80, condição 100, formação 4-3-3 e estratégia equilibrada, campo neutro. Cada cenário usa 600 sementes espelhadas, totalizando 1.200 jogos por cenário. Buff/debuff é aplicado como alteração equivalente de overall antes do encaixe, reproduzindo a fórmula de preparação; não simula a aquisição ou duração do efeito. A configuração dos dois times fica fixa durante cada confronto; sem temporadas, treino, lesões ou histórico de notas entre partidas. Não são pesos que somam 100%, nem probabilidades universais. As mudanças se sobrepõem e podem interagir.',
  '',
  '| Alteração no time observado | Vitória | Empate | Derrota | Mudança na vitória |',
  '|---|---:|---:|---:|---:|',
  ...results.map(
    (r) =>
      '| ' +
      [
        r.label,
        f(r.winRate) + '%',
        f(r.drawRate) + '%',
        f(r.lossRate) + '%',
        (r.winRateChange >= 0 ? '+' : '') + f(r.winRateChange) + ' p.p.',
      ].join(' | ') +
      ' |',
  ),
  '',
  'Média efetiva pode sofrer arredondamento para baixo ao aplicar posição e entrosamento. Assim, diferenças pequenas não são contínuas. Resultados são estimativas amostrais de uma configuração específica. Uma variação pequena de poucos pontos percentuais pode depender da amostra e não deve ser tratada como regra exata.',
  '',
  'O overall do time é derivado dos jogadores; buffs/debuffs e tática modificam esses mesmos valores. Portanto não se deve somar as linhas como efeitos independentes. A formação 4-3-1-2 ainda tem vantagem estrutural conhecida, pendente de balanceamento.',
];
fs.writeFileSync('docs/influencia-fatores-confronto.md', lines.join('\n'));
