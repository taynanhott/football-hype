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
          body:
            a.category === 'coach'
              ? `O prêmio de técnico do ano de ${a.season} tem dono: ${w.name}! À frente do ${w.clubName}, o treinador ganhou os holofotes e fecha a temporada com mais um motivo para comemorar. É dia de celebrar o trabalho de quem comanda o time à beira do campo.`
              : `${w.name}, do ${w.clubName}, venceu a premiação da temporada ${a.season}. O reconhecimento considera desempenho ao longo da temporada, nível das competições, regularidade e títulos.`,
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
      body: `O destaque de ${month} vem do banco do ${a.clubName}: ${a.coachName} leva o prêmio de técnico do mês! Sob seu comando, a equipe somou ${a.wins} ${a.wins === 1 ? 'vitória' : 'vitórias'}, ${a.draws} ${a.draws === 1 ? 'empate' : 'empates'} e ${a.losses} ${a.losses === 1 ? 'derrota' : 'derrotas'} em ${a.games} jogos. Um mês para guardar na memória do treinador e da torcida.`,
      tags: ['#Premiação', '#TécnicoDoMês'],
      homeId: a.clubId,
    };
  });
  return [...annual, ...monthly];
}
