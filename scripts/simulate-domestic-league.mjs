import fs from 'node:fs';
import {
  createWorld,
  importDataset,
  standings,
  resolveLineup,
} from '../packages/domain/dist/index.js';
import { playNextBatch } from '../packages/domain/dist/game/play-batch.js';
import { FORMATIONS } from '../packages/shared/dist/index.js';
const unwrap = (r) => {
  if (!r.ok) throw Error(JSON.stringify(r.error));
  return r.value;
};
const division = (process.env.SIMULATION_DIVISION ?? 'A').toUpperCase();
if (!['A', 'B', 'C', 'D'].includes(division)) throw Error('Invalid division');
const competitionId = 'serie-' + division.toLowerCase();
const label = process.env.SIMULATION_LABEL ?? '';
const output = 'docs/simulacao-' + (label ? label + '-' : '') + 'serie-' + division.toLowerCase();
const dataset = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
let state = unwrap(
  importDataset(
    unwrap(
      createWorld({
        id: '00000001-0000-4000-8000-000000000001',
        userId: 'simulation',
        name: 'Simulação Brasileirão',
        mode: 'offline',
        now: Date.UTC(2026, 0, 1),
      }),
    ),
    dataset,
  ),
);
if (process.env.SIMULATION_SEED) state = { ...state, seed: Number(process.env.SIMULATION_SEED) };
const clubs = Object.values(state.clubs.byId).filter(
  (c) => c.country === 'BR' && c.division === division,
);
const ids = new Set(clubs.map((c) => c.id));
state = {
  ...state,
  participants: [],
  fixtures: state.fixtures.filter((f) => f.competitionId === competitionId),
  cups: [],
  competitionDraws: [],
  regionalQualifiers: [],
  trophies: [],
  results: [],
  seasonClock: undefined,
};
state.clubs = { ids: [...ids], byId: Object.fromEntries(clubs.map((c) => [c.id, c])) };
state.players = {
  ids: state.players.ids.filter((id) => ids.has(state.players.byId[id].clubId)),
  byId: Object.fromEntries(Object.entries(state.players.byId).filter(([, p]) => ids.has(p.clubId))),
};
const initialPlans = {};
const initialStrengths = {};
for (const club of clubs) {
  let best = -Infinity,
    bestFormation = '4-3-3';
  for (const formation of Object.keys(FORMATIONS)) {
    const candidate = {
      ...state,
      tactics: {
        ...state.tactics,
        [club.id]: { ...state.tactics[club.id], formation, style: 'balanced' },
      },
    };
    const quality = resolveLineup(candidate, club, state.createdAt).reduce(
      (sum, e) => sum + e.effectiveOverall,
      0,
    );
    if (quality > best) {
      best = quality;
      bestFormation = formation;
    }
  }
  state.tactics = {
    ...state.tactics,
    [club.id]: { ...state.tactics[club.id], formation: bestFormation, style: 'balanced' },
  };
  initialPlans[club.id] = bestFormation;
  const selected = resolveLineup(state, club, state.createdAt);
  initialStrengths[club.id] = {
    effective: selected.reduce((sum, e) => sum + e.effectiveOverall, 0) / 11,
    raw: selected.reduce((sum, e) => sum + (e.player?.overall ?? 0), 0) / 11,
    stars: club.playerIds.filter((id) => state.players.byId[id]?.overall >= 80).length,
  };
}
const initialSquadAverages = Object.fromEntries(
  clubs.map((club) => {
    const players = club.playerIds.map((id) => state.players.byId[id]).filter(Boolean);
    return [club.id, players.reduce((sum, p) => sum + p.overall, 0) / players.length];
  }),
);
const expectedMatches = state.fixtures.length;
let batches = 0;
while (
  state.results.filter(
    (r) =>
      r.competitionId === competitionId ||
      state.fixtures.some((f) => f.id === r.fixtureId && f.competitionId === competitionId),
  ).length < expectedMatches
) {
  state = unwrap(playNextBatch(state, state.nextScheduledAt));
  batches++;
  if (batches % 5 === 0) console.log('batches', batches, 'matches', state.results.length);
  if (batches > 150) throw Error('too many batches');
}
const fixtures = state.fixtures.filter((f) => f.competitionId === competitionId);
const fixtureIds = new Set(fixtures.map((f) => f.id));
const results = state.results.filter((r) => fixtureIds.has(r.fixtureId));
if (results.length !== expectedMatches) throw Error('Incomplete league');
const stats = (clubId, side) => {
  const matches = results.filter(
    (r) =>
      !clubId ||
      (side === 'home'
        ? r.homeId === clubId
        : side === 'away'
          ? r.awayId === clubId
          : r.homeId === clubId || r.awayId === clubId),
  );
  let w = 0,
    d = 0,
    l = 0;
  for (const r of matches) {
    const home = clubId ? r.homeId === clubId : side !== 'away';
    const diff = (r.homeGoals - r.awayGoals) * (home ? 1 : -1);
    if (diff > 0) w++;
    else if (diff < 0) l++;
    else d++;
  }
  return {
    games: matches.length,
    wins: w,
    draws: d,
    losses: l,
    winRate: (w / matches.length) * 100,
    drawRate: (d / matches.length) * 100,
    lossRate: (l / matches.length) * 100,
  };
};
const table = standings([...ids], fixtures, results).map((c, i) => ({
  ...c,
  rank: i + 1,
  name: state.clubs.byId[c.id].name,
  formation: initialPlans[c.id],
  initialStrength: initialStrengths[c.id],
  squadAverage: initialSquadAverages[c.id],
  overall: stats(c.id),
  home: stats(c.id, 'home'),
  away: stats(c.id, 'away'),
}));
for (const c of table) {
  if (
    c.played !== (clubs.length - 1) * 2 ||
    c.home.games !== clubs.length - 1 ||
    c.away.games !== clubs.length - 1
  )
    throw Error('Invalid home/away counts');
}
const summary = {
  division,
  clubs: clubs.length,
  goalsPerMatch: results.reduce((sum, r) => sum + r.homeGoals + r.awayGoals, 0) / results.length,
  overall: {
    games: results.length * 2,
    winRate:
      (results.filter((r) => r.homeGoals !== r.awayGoals).length / (results.length * 2)) * 100,
    drawRate: (results.filter((r) => r.homeGoals === r.awayGoals).length / results.length) * 100,
    lossRate:
      (results.filter((r) => r.homeGoals !== r.awayGoals).length / (results.length * 2)) * 100,
  },
  matches: results.length,
  home: stats(null, 'home'),
  away: stats(null, 'away'),
  goals: results.reduce((s, r) => s + r.homeGoals + r.awayGoals, 0),
};
fs.writeFileSync(
  output + '.json',
  JSON.stringify(
    {
      assumptions: {
        seed: state.seed,
        season: state.season,
        scope:
          'Division ' +
          division +
          (label ? ' only; experimental squad-strength proposal' : ' only; current engine') +
          '; no cups, transfers or user interventions; formation chosen by initial lineup quality; bot styles adapt through game engine',
        batches,
      },
      summary,
      table,
    },
    null,
    2,
  ),
);
const lines = [
  '# Simulação do Brasileirão',
  '',
  'Uma temporada com 380 jogos. Base local atual, buffs e debuffs, entrosamento de 50%, lesões, desgaste, treino e evolução do motor. Formação inicial escolhida pela maior soma de overall efetivo dos titulares; estilos dos bots reagem ao histórico tático. Sem copas, transferências ou intervenções humanas. Resultado de uma execução, não previsão estatística.',
  '',
  '| Pos. | Clube | Pts | V | E | D | GP | GC | SG | Formação inicial |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|---|',
  ...table.map(
    (c) =>
      '| ' +
      [
        c.rank,
        c.name,
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
];
fs.writeFileSync(output + '.md', lines.join('\n'));
console.log(
  JSON.stringify({
    summary,
    table: table.map((c) => ({
      name: c.name,
      points: c.points,
      w: c.wins,
      d: c.draws,
      l: c.losses,
      gd: c.goalDifference,
      home: c.home,
      away: c.away,
    })),
  }),
);
