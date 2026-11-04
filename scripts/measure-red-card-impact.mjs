import fs from 'node:fs';
import { simulateMatch } from '../packages/domain/dist/index.js';
import { FORMATIONS } from '../packages/shared/dist/index.js';
const db = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8')),
  template = Object.values(db.players.byId)[0],
  stadium = Object.values(db.stadiums.byId)[0];
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
const count = 1000;
const rows = [];
for (const minute of [null, 0, 30, 60, 80]) {
  let w = 0,
    d = 0,
    l = 0,
    gf = 0,
    ga = 0;
  for (let i = 0; i < count; i++) {
    const home = i % 2 === 0,
      own = squad('own'),
      other = squad('other'),
      id = own.find((p) => p.position === 'DM')?.id ?? own[5].id;
    const fixture = {
      id: 'red-audit-' + Math.floor(i / 2),
      competitionId: 'audit',
      round: 0,
      homeId: home ? 'own' : 'other',
      awayId: home ? 'other' : 'own',
      scheduledAt: Date.UTC(2026, 0, 1),
      neutral: true,
    };
    const result = simulateMatch(
      fixture,
      home ? own : other,
      home ? other : own,
      stadium,
      20261104,
      undefined,
      undefined,
      undefined,
      minute === null
        ? {}
        : { scenarioDismissals: [{ side: home ? 'home' : 'away', playerId: id, minute }] },
    );
    const a = home ? result.homeGoals : result.awayGoals,
      b = home ? result.awayGoals : result.homeGoals;
    gf += a;
    ga += b;
    if (a > b) w++;
    else if (a < b) l++;
    else d++;
    if (
      minute !== null &&
      (result.minutesPlayed[id] === undefined || result.minutesPlayed[id] > minute)
    )
      throw Error('Dismissed minutes incorrect');
  }
  rows.push({
    minute,
    matches: count,
    wins: w,
    draws: d,
    losses: l,
    winRate: (w / count) * 100,
    drawRate: (d / count) * 100,
    lossRate: (l / count) * 100,
    goalsFor: gf / count,
    goalsAgainst: ga / count,
  });
  console.log(JSON.stringify(rows.at(-1)));
}
fs.writeFileSync(
  'docs/impacto-expulsao.json',
  JSON.stringify(
    {
      conditions:
        'Equal 70-overall teams; neutral; 500 mirrored seeds per scenario; controlled dismissal of a midfielder; natural cards still possible; one match per run without season effects',
      rows,
    },
    null,
    2,
  ),
);
const f = (x) => x.toFixed(1).replace('.', ',');
const lines = [
  '# Impacto de expulsões no motor',
  '',
  'Times equivalentes (overall 70), campo neutro, condição 100 e moral 80. Mil jogos por cenário, usando 500 sementes espelhadas. Expulsão controlada de um meio-campista. Cartões naturais continuam possíveis; não é uma amostra exclusivamente de uma expulsão por partida. Parâmetros de jogo e simulação local, sem equivalência automática a estatísticas do Brasileirão real.',
  '',
  '| Expulsão | Vitória do punido | Empate | Derrota do punido | Gols marcados/jogo | Gols sofridos/jogo |',
  '|---|---:|---:|---:|---:|---:|',
  ...rows.map(
    (r) =>
      '| ' +
      [
        r.minute === null ? 'Sem expulsão controlada' : r.minute + ' min',
        f(r.winRate) + '%',
        f(r.drawRate) + '%',
        f(r.lossRate) + '%',
        f(r.goalsFor),
        f(r.goalsAgainst),
      ].join(' | ') +
      ' |',
  ),
  '',
  'A perda aplica-se somente após a expulsão: jogador removido das ações e da força coletiva, menor qualidade ofensiva, maior exposição defensiva e cansaço crescente. Pênaltis não recebem o multiplicador de desvantagem numérica. Dez contra dez não produz a vantagem relativa de onze contra dez, mas mantém a perda de cobertura e o desgaste de cada equipe. Minutos do expulso param no cartão. Substitutos recebem desgaste extra apenas no intervalo em que efetivamente jogam.',
  '',
  'Referência metodológica: https://www.tandfonline.com/doi/abs/10.1080/01621459.1994.10476850 — importância da força relativa e do momento da expulsão. Não adotamos os percentuais da imagem como garantia ou parâmetro universal.',
];
fs.writeFileSync('docs/impacto-expulsao.md', lines.join('\n'));
