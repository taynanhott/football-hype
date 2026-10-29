import { readFile, writeFile } from 'node:fs/promises';
import {
  createWorld,
  importDataset,
  normalizeRoundCalendar,
  realizeCompetitionDraws,
} from '../packages/domain/dist/index.js';
import { COMPETITIONS } from '../packages/shared/dist/index.js';
const unwrap = (result) => {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};
const dataset = JSON.parse(
  await readFile(new URL('../data/player-database.json', import.meta.url), 'utf8'),
);
const initial = normalizeRoundCalendar(
  unwrap(
    importDataset(
      unwrap(
        createWorld({
          id: '00000000-0000-4000-8000-000000000007',
          userId: 'calendar-audit',
          name: 'Auditoria',
          mode: 'offline',
          now: Date.UTC(2026, 0, 11, 12),
          seed: 123,
        }),
      ),
      dataset,
    ),
  ),
);
const state = realizeCompetitionDraws(
  {
    ...initial,
    cups: initial.cups.map((n) =>
      n.competitionId === 'pre-libertadores' ? { ...n, winnerId: n.homeId } : n,
    ),
  },
  Date.UTC(2026, 3, 1),
);
const ids = [
  'serie-a',
  'serie-b',
  'serie-c',
  'copa-brasil',
  'pre-libertadores',
  'libertadores',
  'sul-americana',
  'copa-nordeste',
  'copa-sul-sudeste',
  'copa-verde',
];
const name = (id) => COMPETITIONS.find((r) => r.id === id)?.name ?? id;
const entrants = (id) =>
  new Set([
    ...state.fixtures.filter((f) => f.competitionId === id).flatMap((f) => [f.homeId, f.awayId]),
    ...state.cups
      .filter((n) => n.competitionId === id)
      .flatMap((n) => [n.homeId, n.awayId])
      .filter(Boolean),
  ]);
const sets = Object.fromEntries(ids.map((id) => [id, entrants(id)]));
const shared = (a, b) => [...sets[a]].filter((id) => sets[b].has(id));
const lines = [
  '# Calendário e participação — base inicial de 2026',
  '',
  'Relatório do jogo, gerado com as listas fixas e a base de clubes do repositório. Não é um regulamento oficial da CBF. As temporadas seguintes usam classificação, títulos, acesso e descenso.',
  '',
  '## Regras aplicadas',
  '',
  '- Uma rodada inteira usa a mesma data de jogo e o mesmo horário real para todos os usuários da liga.',
  '- Rodadas com clubes distintos podem compartilhar data e horário real. Um clube não pode jogar duas vezes no mesmo dia.',
  '- Mata-matas ainda indefinidos reservam as datas com os possíveis classificados. A agenda não depende do clube escolhido pelo usuário.',
  '- Entre rodadas da mesma competição permanecem pelo menos dois dias livres. Entre competições diferentes a proibição é disputar dois jogos no mesmo dia.',
  '- A Série A passa a ter jogos em junho. Foi removida a pausa explícita de 1º de junho a 19 de julho; as referências distribuem as rodadas ao longo da temporada em domingos e quartas. Conflitos podem deslocar o dia.',
  '- O sorteio inicial define os grupos ou a chave. As datas até a final são mostradas como condicionais; não são inventados novos sorteios para fases cuja chave já está definida.',
  '',
  '## Participantes brasileiros por divisão',
  '',
  '| Campeonato | Série A | Série B | Série C |',
  '|---|---:|---:|---:|',
];
for (const id of ids)
  lines.push(
    `| ${name(id)} | ${['A', 'B', 'C'].map((d) => [...sets[id]].filter((id) => state.clubs.byId[id]?.country === 'BR' && state.clubs.byId[id]?.division === d).length).join(' | ')} |`,
  );
lines.push(
  '',
  'Há clubes da Série A nas listas regionais atuais: a divisão, sozinha, não determina a permissão. Os continentais iniciais usam clubes brasileiros da A; em temporadas seguintes um título pode classificar um clube de outra divisão. A pré-Libertadores envia seus vencedores à Libertadores e os perdedores à Sul-Americana. As duas copas ficam sem participantes comuns depois dessa definição.',
  '',
  '## Rodadas que podem compartilhar uma data',
  '',
  '“Condicional” significa que há clubes comuns no torneio: uma rodada só pode coincidir se nenhum desses clubes puder disputar as duas. Na fase de liga, a rodada inclui todos os clubes daquela divisão. Na fase de grupos de uma copa, todos os participantes jogam. Depois de eliminações, a restrição pode desaparecer.',
  '',
  '| Par de competições | Mesma data | Clubes em comum nesta auditoria |',
  '|---|---|---|',
);
for (let a = 0; a < ids.length; a++)
  for (let b = a + 1; b < ids.length; b++) {
    const common = shared(ids[a], ids[b]);
    lines.push(
      `| ${name(ids[a])} × ${name(ids[b])} | ${common.length ? 'Condicional: separar enquanto houver clubes comuns na rodada' : 'Permitida'} | ${common.map((id) => state.clubs.byId[id]?.name ?? id).join(', ') || 'Nenhum'} |`,
    );
  }
lines.push(
  '',
  'A pré-Libertadores foi resolvida com os mandantes como vencedores apenas para produzir um exemplo reproduzível; o resultado real da liga pode mudar os nomes, sem alterar a regra de não sobrepor o mesmo clube.',
  '',
  '## Clubes e copas por divisão',
  '',
);
for (const division of ['A', 'B', 'C']) {
  lines.push(`### Série ${division}`, '', '| Clube | Copas na base inicial |', '|---|---|');
  for (const club of Object.values(state.clubs.byId)
    .filter((c) => c.country === 'BR' && c.division === division)
    .sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(
      `| ${club.name} | ${
        ids
          .filter((id) => !id.startsWith('serie-') && sets[id].has(club.id))
          .map(name)
          .join(', ') || 'Nenhuma das copas listadas'
      } |`,
    );
  }
  lines.push('');
}
await writeFile(new URL('../docs/calendar-audit.md', import.meta.url), lines.join('\n'));
console.log('docs/calendar-audit.md atualizado');
