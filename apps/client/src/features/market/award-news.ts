import type { WorldState } from '@football/shared';
export const awardTitles = {
  'team-br': 'Seleção do ano do Brasil',
  'team-world': 'Seleção do ano do mundo',
  coach: 'Técnico do ano',
  keeper: 'Goleiro do ano',
  'player-br': 'Jogador do ano do Brasil',
  'player-world': 'Jogador do ano do mundo',
};
export function awardNews(state: WorldState) {
  return (state.seasonAwards ?? [])
    .filter((a) => !a.category.startsWith('team'))
    .flatMap((a) => {
      const w = a.winners[0];
      if (!w) return [];
      return [
        {
          id: `award:${a.season}:${a.category}`,
          at: a.awardedAt,
          title: `${w.name} é ${awardTitles[a.category].toLowerCase()}!`,
          body: `${w.name}, do ${w.clubName}, venceu a premiação da temporada ${a.season}. O reconhecimento considera desempenho ao longo da temporada, nível das competições, regularidade e títulos.`,
          tags: ['#Premiação', '#Temporada'],
          homeId: w.clubId,
        },
      ];
    });
}
