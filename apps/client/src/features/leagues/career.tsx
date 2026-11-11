import { isRival } from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { Icon, ClubBadge } from '../../ui/icons';

export function Career({ snapshot, club, trainerId }: ViewProps & { trainerId?: string }) {
  const { state } = snapshot;
  const seasons = [...(state.seasonArchives ?? []), state];
  const games = seasons.flatMap((season) =>
    season.results.flatMap((result) => {
      const fixture = season.fixtures.find((f) => f.id === result.fixtureId);
      if (!fixture) return [];
      if (
        trainerId
          ? result.coachUserIds?.home !== trainerId && result.coachUserIds?.away !== trainerId
          : fixture.homeId !== club.id && fixture.awayId !== club.id
      )
        return [];
      const home = trainerId ? result.coachUserIds?.home === trainerId : fixture.homeId === club.id;
      const opponent = season.clubs.byId[home ? fixture.awayId : fixture.homeId];
      return [
        {
          id: result.fixtureId,
          season: season.season,
          goals: home ? result.homeGoals : result.awayGoals,
          conceded: home ? result.awayGoals : result.homeGoals,
          opponent,
          penaltiesWon: result.penalties
            ? home
              ? result.penalties.home > result.penalties.away
              : result.penalties.away > result.penalties.home
            : false,
        },
      ];
    }),
  );
  const wins = games.filter((g) => g.goals > g.conceded).length;
  const draws = games.filter((g) => g.goals === g.conceded).length;
  const losses = games.length - wins - draws;
  const best = [...games]
    .filter((g) => g.goals > g.conceded)
    .sort((a, b) => b.goals - b.conceded - (a.goals - a.conceded) || b.goals - a.goals)[0];
  const worst = [...games]
    .filter((g) => g.goals < g.conceded)
    .sort((a, b) => a.goals - a.conceded - (b.goals - b.conceded) || b.conceded - a.conceded)[0];
  const metrics = [
    [
      'Técnico do ano',
      (state.seasonAwards ?? []).filter(
        (a) =>
          a.category === 'coach' &&
          (trainerId ? a.winners[0]?.coachUserId === trainerId : a.winners[0]?.clubId === club.id),
      ).length,
    ],
    [
      'Técnico do mês',
      (state.monthlyCoachAwards ?? []).filter((a) =>
        trainerId ? a.coachUserId === trainerId : a.clubId === club.id,
      ).length,
    ],
    ['Jogos', games.length],
    ['Vitórias', wins],
    ['Empates', draws],
    ['Derrotas', losses],
    [
      'Aproveitamento',
      games.length
        ? `${(((wins * 3 + draws) / (games.length * 3)) * 100).toFixed(1).replace('.', ',')}%`
        : '—',
    ],
    ['Gols feitos', games.reduce((s, g) => s + g.goals, 0)],
    ['Gols sofridos', games.reduce((s, g) => s + g.conceded, 0)],
    [
      'Clássicos ganhos',
      games.filter(
        (g) =>
          g.opponent &&
          isRival(club, g.opponent) &&
          (g.goals > g.conceded || (g.goals === g.conceded && g.penaltiesWon)),
      ).length,
    ],
  ];
  const metricCards = metrics.map(([label, value], index) => (
    <article
      className={`panel career-metric career-metric-${index === 1 ? 'monthly' : index > 1 ? index - 1 : index}`}
      key={label}
    >
      <Icon
        name={
          [
            'calendar',
            'calendar',
            'trophy',
            'handshake',
            'shield',
            'finance',
            'ball',
            'shield',
            'trophy',
          ][index] ?? 'ball'
        }
      />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  ));
  return (
    <section className="career-hub" aria-label="Carreira">
      <div className="career-metrics">{metricCards.slice(2, -1)}</div>
      <div className="career-records">
        {[
          ['Maior placar a favor', best],
          ['Pior placar', worst],
        ].map(([label, game]) => {
          const g = game as typeof best;
          const positive = label === 'Maior placar a favor';
          return (
            <article
              className={`panel career-record ${positive ? 'career-record-best' : 'career-record-worst'}`}
              key={String(label)}
            >
              <h2>
                <Icon name={positive ? 'trophy' : 'shield'} size={16} />
                {String(label)}
              </h2>
              <strong className="career-score">{g ? `${g.goals} × ${g.conceded}` : '—'}</strong>
              {g ? (
                <div className="career-record-opponent">
                  {g.opponent && <ClubBadge name={g.opponent.name} size={32} />}
                  <div>
                    <strong>{g.opponent?.name ?? 'Adversário'}</strong>
                    <small>Temporada {g.season}</small>
                  </div>
                </div>
              ) : (
                <span className="career-record-empty">Nenhuma partida registrada</span>
              )}
            </article>
          );
        })}
        {metricCards.at(-1)}
        {metricCards.slice(0, 2)}
      </div>
      <section className="panel career-journey">
        <h2>
          <Icon name="squad" /> Clubes que treinei
        </h2>
        <div className="career-club">
          <ClubBadge name={club.name} size={48} />
          <div className="career-club-identity">
            <strong>{club.name}</strong>
            <span className="career-club-status">Clube atual</span>
          </div>
          <div className="career-club-games">
            <strong>{games.length}</strong>
            <span>partidas disputadas</span>
          </div>
        </div>
      </section>
    </section>
  );
}
