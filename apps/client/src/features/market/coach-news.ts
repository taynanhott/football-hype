import type { WorldState } from '@football/shared';
export function coachNews(state: WorldState) {
  return (state.coachOffers ?? [])
    .filter((o) => o.status === 'accepted')
    .map((o) => {
      const record = o.announcement;
      const name =
        record?.coachName ??
        state.participants.find((p) => p.userId === o.userId)?.coach?.name ??
        'Novo treinador';
      const club = record?.clubName ?? state.clubs.byId[o.clubId]?.name ?? 'novo clube';
      const previous =
        record?.fromClubName ?? state.clubs.byId[o.fromClubId]?.name ?? 'clube anterior';
      return {
        id: 'coach-change:' + o.id,
        at: record?.at ?? 0,
        title: club + ' anuncia ' + name + ' como novo técnico',
        body:
          name +
          ' deixou o ' +
          previous +
          ' e foi apresentado em coletiva de imprensa como novo treinador do ' +
          club +
          '. A diretoria aposta no treinador para os próximos desafios.',
        tags: ['#TrocaDeTreinador', '#MercadoDaBola'],
        homeId: o.clubId,
        awayId: o.fromClubId,
      };
    });
}
