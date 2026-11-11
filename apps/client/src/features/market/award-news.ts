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
  const annual = (state.seasonAwards ?? [])
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
  const monthly = (state.monthlyCoachAwards ?? []).map((a) => {
    const month = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${a.month}-01T12:00:00Z`));
    return {
      id: `coach-month:${a.season}:${a.month}`,
      at: a.awardedAt,
      title: `${a.coachName} é eleito técnico do mês de ${month}!`,
      body: `${a.coachName}, do ${a.clubName}, venceu a premiação nacional com ${a.wins} vitórias, ${a.draws} empates e ${a.losses} derrotas em ${a.games} jogos. A escolha considera o aproveitamento, a regularidade e o peso da liga: Série A (80), B (65), C (50) e D (35), com ao menos três partidas no mês.`,
      tags: ['#Premiação', '#TécnicoDoMês'],
      homeId: a.clubId,
    };
  });
  return [...annual, ...monthly];
}
