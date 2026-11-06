import { scheduledFixtures } from '@football/domain';
import type { WorldState } from '@football/shared';

const JOKES = [
  'O roupeiro pediu direito de imagem: apareceu mais na transmissão que o centroavante.',
  'A bola do treino sumiu. O lateral garante que o cruzamento ainda está descendo.',
  'A diretoria prometeu um reforço de peso. Chegou uma geladeira nova ao vestiário.',
  'O goleiro pediu silêncio no treino: estava tentando ouvir os conselhos da trave.',
  'O gandula recebeu proposta para renovar depois de liderar as assistências no aquecimento.',
  'O técnico escondeu a escalação até do próprio quadro tático. Nem os ímãs sabem quem joga.',
  'O atacante treinou finalizações escondido. A vizinhança pediu a devolução das bolas.',
  'A torcida pediu raça. O mascote interpretou literalmente e entrou com um cachorro.',
];
const NETO_JOKES = [
  'Neymar, o controle de videogame já está aquecido. Agora falta aquecer a chuteira! A torcida quer o drible no campo, não no menu.',
  'Se cada rumor de volta do Neymar valesse um gol, o placar precisava de mais dois dígitos. Deixa a bola falar agora!',
  'Corinthians, meu coração não tem banco de reservas! Resolve esse jogo antes que eu precise pedir substituição no sofá.',
  'No Corinthians até o café do intervalo vem com emoção. Eu pedi três pontos, não três sustos e um pão de queijo!',
];

export function roundNews(state: WorldState) {
  const fixtures = new Map(scheduledFixtures(state).map((f) => [f.id, f]));
  const rounds = new Map<number, (typeof state.results)[number][]>();
  for (const result of state.results) {
    const fixture = fixtures.get(result.fixtureId);
    if (!fixture) continue;
    const group = rounds.get(fixture.scheduledAt) ?? [];
    if (!group.some((r) => r.fixtureId === result.fixtureId)) group.push(result);
    rounds.set(fixture.scheduledAt, group);
  }
  return [...rounds]
    .sort(([a], [b]) => b - a)
    .slice(0, 8)
    .flatMap(([day, results]) => {
      const at = Math.max(...results.map((r) => r.startedAt ?? day));
      const highlights = [...results]
        .sort(
          (a, b) =>
            Math.abs(b.homeGoals - b.awayGoals) - Math.abs(a.homeGoals - a.awayGoals) ||
            b.homeGoals + b.awayGoals - (a.homeGoals + a.awayGoals) ||
            a.fixtureId.localeCompare(b.fixtureId),
        )
        .slice(0, 3)
        .map((result, index) => {
          const fixture = fixtures.get(result.fixtureId)!;
          const home = state.clubs.byId[fixture.homeId]?.name ?? 'Mandante';
          const away = state.clubs.byId[fixture.awayId]?.name ?? 'Visitante';
          const score = `${home} ${result.homeGoals} × ${result.awayGoals} ${away}`;
          const margin = Math.abs(result.homeGoals - result.awayGoals);
          const shock = ['Que atropelo!', 'É de cair o queixo!', 'Virou um passeio!'];
          return {
            id: `score:${result.fixtureId}`,
            reporterName: undefined as string | undefined,
            at: at + index,
            title: margin >= 3 ? `${shock[index]} ${score}` : `Destaque da rodada: ${score}`,
            body:
              margin >= 3
                ? 'A torcida mal teve tempo de comemorar um gol e já vinha outro! Uma goleada para ficar na memória da rodada.'
                : 'Um dos três maiores placares da rodada, em destaque no giro dos resultados.',
            tags: ['#GiroDaRodada', ...(margin >= 3 ? ['#Goleada'] : [])],
          };
        });
      const seed = Math.abs(Math.floor(day / 86400000));
      const jokes = Array.from({ length: 1 + (seed % 2) }, (_, index) => ({
        id: `resenha:${day}:${index}`,
        at: at + 0.5 + index,
        title: 'Resenha do vestiário · notícia fictícia',
        body:
          index === 0 && seed % 2 === 0
            ? NETO_JOKES[Math.floor(seed / 2) % NETO_JOKES.length]!
            : JOKES[(seed + index * 3) % JOKES.length]!,
        reporterName: index === 0 && seed % 2 === 0 ? 'Craque Neto' : undefined,
        tags: [
          '#ResenhaFictícia',
          ...(index === 0 && seed % 2 === 0
            ? [
                '#CraqueNeto',
                Math.floor(seed / 2) % NETO_JOKES.length < 2 ? '#Neymar' : '#Corinthians',
              ]
            : []),
        ],
      }));
      return [...highlights, ...jokes];
    });
}
