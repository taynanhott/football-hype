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
    ['Jogos', games.length],
    ['Vitórias', wins],
    ['Empates', draws],
    ['Derrotas', losses],
    [
      'Aproveitamento',
      games.length ? `${(((wins * 3 + draws) / (games.length * 3)) * 100).toFixed(1)}%` : '—',
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
  return (
    <section className="career-hub" aria-label="Carreira">
      <div className="career-metrics">
        {metrics.map(([label, value], index) => (
          <article className={`panel career-metric career-metric-${index}`} key={label}>
            <Icon
              name={
                [
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
        ))}
      </div>
      <div className="career-records">
        {[
          ['Maior placar a favor', best],
          ['Pior placar', worst],
        ].map(([label, game]) => {
          const g = game as typeof best;
          return (
            <article
              className={`panel career-record ${g === best ? 'career-record-best' : 'career-record-worst'}`}
              key={String(label)}
            >
              <h2>
                <Icon name={g === best ? 'trophy' : 'shield'} size={20} />
                {String(label)}
              </h2>
              <strong className="career-score">{g ? `${g.goals} × ${g.conceded}` : '—'}</strong>
              {g && <p>{`Contra ${g.opponent?.name ?? 'Adversário'} · Temporada ${g.season}`}</p>}
            </article>
          );
        })}
      </div>
      <section className="panel career-journey">
        <h2>
          <Icon name="squad" /> Clubes que treinei
        </h2>
        <div className="career-club">
          <ClubBadge name={club.name} />
          <div>
            <strong>{club.name}</strong>
            <p>Clube atual · {games.length} partidas disponíveis</p>
          </div>
        </div>
      </section>
    </section>
  );
}
