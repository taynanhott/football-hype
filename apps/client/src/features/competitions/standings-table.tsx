import { continentalPlaces } from '@football/domain';
import { COMPETITIONS, type GameSnapshot } from '@football/shared';
import { PixelBadge } from '../../ui/pixel-badge';

type Props = {
  state: GameSnapshot['state'];
  table: Readonly<GameSnapshot['tables'][string]>;
  competitionId: string;
  clubId: string;
  group?: string;
};

export function StandingsTable({ state, table, competitionId, clubId, group }: Props) {
  const places = competitionId === 'serie-a' ? continentalPlaces(state) : [];
  const rule = COMPETITIONS.find((item) => item.id === competitionId);
  const qualifier = state.regionalQualifiers?.find((q) => q.competitionId === competitionId);
  const fixtures = new Map(
    state.fixtures
      .filter(
        (item) =>
          item.competitionId === competitionId &&
          (group ? item.group === group || item.awayGroup === group : !item.group),
      )
      .map((item) => [item.id, item]),
  );
  const results = state.results
    .filter((item) => fixtures.has(item.fixtureId))
    .sort(
      (a, b) =>
        (fixtures.get(a.fixtureId)?.scheduledAt ?? 0) -
        (fixtures.get(b.fixtureId)?.scheduledAt ?? 0),
    );
  const zones = group
    ? [
        {
          key: 'promotion',
          name:
            competitionId === 'serie-c'
              ? 'Acesso à Série B'
              : rule?.advancement === 'sudamericana'
                ? rule.groupCount === 4
                  ? '1º: quartas · 2º: playoff'
                  : '1º: oitavas · 2º: playoff'
                : rule?.advancement === 'mineiro'
                  ? 'Líder e melhor segundo geral avançam'
                  : 'Classificados para o mata-mata',
          count: 2,
        },
      ]
    : [
        ...(qualifier?.slots
          ? [{ key: 'promotion', name: 'Vaga na copa regional', count: qualifier.slots }]
          : []),
        ...(rule?.promote ? [{ key: 'promotion', name: 'Acesso', count: rule.promote }] : []),
        ...(rule?.continental
          ? [{ key: 'continental', name: 'Libertadores', count: rule.continental }]
          : []),
        ...(rule?.secondaryContinental
          ? [{ key: 'secondary', name: 'Sul-Americana', count: rule.secondaryContinental }]
          : []),
        ...(rule?.relegate
          ? [{ key: 'relegation', name: 'Rebaixamento', count: rule.relegate }]
          : []),
      ];
  function zone(index: number) {
    if (qualifier) return index < qualifier.slots ? 'promotion' : '';
    if (group) return index < (rule?.advancement === 'mineiro' ? 1 : 2) ? 'promotion' : '';
    if (competitionId === 'serie-a') {
      const place = places.find((place) => place.clubId === table[index]?.id);
      if (place)
        return place.competition === 'libertadores'
          ? 'continental'
          : place.competition === 'pre-libertadores'
            ? 'pre'
            : 'secondary';
    }
    if (rule?.relegate && index >= table.length - rule.relegate) return 'relegation';
    if (rule?.promote && index < rule.promote) return 'promotion';
    if (rule?.continental && index < rule.continental) return 'continental';
    if (rule?.secondaryContinental && index < (rule.continental ?? 0) + rule.secondaryContinental)
      return 'secondary';
    return '';
  }
  return (
    <section
      className={`standings-card ${!group && rule?.format === 'league' ? 'standings-league' : ''}`}
    >
      {group && (
        <header className="standings-heading">
          <h2>Grupo {group}</h2>
        </header>
      )}
      <div
        className="standings-scroll"
        tabIndex={0}
        role="region"
        aria-label="Tabela de classificação"
      >
        <table className="standings-table">
          <caption className="standings-sr-only">
            {rule?.name ?? 'Classificação'} · Temporada {state.season}
          </caption>
          <thead>
            <tr>
              <th scope="col" colSpan={2}>
                Clube
              </th>
              {[
                ['Pts', 'Pontos'],
                ['J', 'Jogos'],
                ['V', 'Vitórias'],
                ['E', 'Empates'],
                ['D', 'Derrotas'],
                ['GP', 'Gols pró'],
                ['GC', 'Gols contra'],
                ['SG', 'Saldo de gols'],
                ['Últimos 5', 'Últimos cinco resultados'],
              ].map(([label, title]) => (
                <th key={label} scope="col" title={title}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.map((row, index) => {
              const team = state.clubs.byId[row.id];
              const last = results
                .filter((match) => {
                  const fixture = fixtures.get(match.fixtureId)!;
                  return fixture.homeId === row.id || fixture.awayId === row.id;
                })
                .slice(-5);
              return (
                <tr
                  key={row.id}
                  className={`${row.id === clubId ? 'standings-my-club' : ''} zone-${zone(index)}`}
                >
                  <td className="standings-rank">{index + 1}</td>
                  <th scope="row" className="standings-club">
                    <a href={`#/trophies?club=${row.id}`}>
                      <PixelBadge
                        name={team?.name ?? 'Clube'}
                        {...(team?.crestUrl ? { url: team.crestUrl } : {})}
                        size={group && rule?.groupCount === 4 ? 24 : 18}
                      />
                      <span>{team?.name ?? 'Clube'}</span>
                      {places.find((place) => place.clubId === row.id)?.origin === 'title' && (
                        <span title="Vaga pelo título" aria-label="Vaga pelo título">
                          ★
                        </span>
                      )}
                      {places.find((place) => place.clubId === row.id)?.origin === 'inherited' && (
                        <span title="Vaga herdada" aria-label="Vaga herdada">
                          ↳
                        </span>
                      )}
                    </a>
                  </th>
                  {[
                    row.points,
                    row.played,
                    row.wins,
                    row.draws,
                    row.losses,
                    row.goalsFor,
                    row.goalsAgainst,
                    row.goalDifference,
                  ].map((value, column) => (
                    <td key={column} className={column === 0 ? 'standings-points' : ''}>
                      {value}
                    </td>
                  ))}
                  <td>
                    <div className="standings-form">
                      {Array.from({ length: 5 - last.length }, (_, i) => (
                        <span
                          className="form-dot form-empty"
                          key={`empty-${i}`}
                          aria-label="Sem partida"
                        >
                          ·
                        </span>
                      ))}
                      {last.map((match, i) => {
                        const fixture = fixtures.get(match.fixtureId)!;
                        const home = fixture.homeId === row.id;
                        const goals = home ? match.homeGoals : match.awayGoals;
                        const conceded = home ? match.awayGoals : match.homeGoals;
                        const outcome =
                          goals > conceded ? 'win' : goals === conceded ? 'draw' : 'loss';
                        const label =
                          outcome === 'win' ? 'Vitória' : outcome === 'draw' ? 'Empate' : 'Derrota';
                        const opponent =
                          state.clubs.byId[home ? fixture.awayId : fixture.homeId]?.name ??
                          'Adversário';
                        return (
                          <span
                            key={match.fixtureId}
                            className={`form-dot form-${outcome} ${i === last.length - 1 ? 'form-latest' : ''}`}
                            title={`${label}: ${goals} × ${conceded} · ${opponent}`}
                            aria-label={`${label}: ${goals} a ${conceded} contra ${opponent}`}
                          >
                            {outcome === 'win' ? '✓' : outcome === 'draw' ? '−' : '×'}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="standings-legend">
        {competitionId === 'serie-a' && (
          <>
            <span>Libertadores · Pré-Libertadores · Sul-Americana</span>
            <span>★ vaga por título · ↳ vaga herdada · limite de repasse: 16º</span>
          </>
        )}
        {zones.map((item) => (
          <span key={item.key}>
            <i className={`zone-${item.key}`} />
            {item.name}
          </span>
        ))}
        <span>Últimos 5: do mais antigo ao mais recente</span>
      </footer>
    </section>
  );
}
