import { cupReturnDate } from '@football/domain';
import { Icon } from '../../ui/icons';
import { Select, Option } from '../../ui/select';
import { useState } from 'react';
import { cupGroupTables, standings } from '@football/domain';
import { CupBracket } from './cup-bracket';
import { COMPETITIONS, type Fixture } from '@football/shared';
import type { ViewProps } from '../../ui/view-props';
import { StandingsTable } from './standings-table';
import { PixelBadge } from '../../ui/pixel-badge';
import { dateTime } from '../../ui/format';

export function Calendar({ snapshot, club }: ViewProps) {
  const [competition, setCompetition] = useState(
    club.division === 'D' || club.division === 'REGIONAL'
      ? 'serie-a'
      : `serie-${club.division.toLowerCase()}`,
  );
  const [tab, setTab] = useState('table');
  const [cupStage, setCupStage] = useState('groups');
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const archive = snapshot.state.seasonArchives?.find((item) => item.season === selectedSeason);
  const state = archive
    ? { ...snapshot.state, competitionNotes: undefined, ...archive }
    : snapshot.state;
  const seasons = [
    snapshot.state.season,
    ...(snapshot.state.seasonArchives ?? []).map((item) => item.season),
  ].sort((a, b) => b - a);
  const rule = COMPETITIONS.find((item) => item.id === competition);
  const table = archive
    ? rule?.format === 'league'
      ? standings(
          state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === rule.division),
          state.fixtures.filter(
            (fixture) => fixture.competitionId === competition && !fixture.group,
          ),
          state.results,
          rule.tieBreakers,
        )
      : undefined
    : snapshot.tables[competition];
  const knockoutFixtures: Fixture[] = state.cups
    .filter((node) => node.competitionId === competition && node.homeId && node.awayId)
    .flatMap((node) => {
      const first = {
        id: (node.legs ?? rule?.legs) === 2 ? `${node.id}:first` : node.id,
        competitionId: competition,
        round: node.round,
        homeId: node.homeId!,
        awayId: node.awayId!,
        scheduledAt: node.scheduledAt,
      };
      return (node.legs ?? rule?.legs) === 2
        ? [
            first,
            {
              ...first,
              id: node.id,
              homeId: node.awayId!,
              awayId: node.homeId!,
              scheduledAt: cupReturnDate(node.competitionId, node.scheduledAt),
            },
          ]
        : [first];
    });
  const knockoutIds = new Set(knockoutFixtures.map((fixture) => fixture.id));
  const competitionFixtures = [
    ...new Map(
      [...state.fixtures, ...knockoutFixtures]
        .filter((fixture) => fixture.competitionId === competition)
        .map((fixture) => [fixture.id, fixture]),
    ).values(),
  ].sort((a, b) => a.scheduledAt - b.scheduledAt || a.id.localeCompare(b.id));
  const fixtures = competitionFixtures.filter(
    (fixture) => fixture.homeId === club.id || fixture.awayId === club.id,
  );
  const selectedClub = state.clubs.byId[club.id];
  const participates =
    Boolean(selectedClub) &&
    (rule?.format === 'league'
      ? selectedClub?.division === rule.division && fixtures.length > 0
      : fixtures.length > 0 ||
        state.cups.some(
          (node) =>
            node.competitionId === competition &&
            (node.homeId === club.id || node.awayId === club.id),
        ));
  const activeTab = tab === 'fixtures' && !participates ? 'table' : tab;
  const phaseOf = (fixture: Fixture) =>
    fixture.group ? 'groups' : knockoutIds.has(fixture.id) ? 'knockout' : 'league';
  const completed = new Set(state.results.map((result) => result.fixtureId));
  const pending = competitionFixtures.filter((fixture) => !completed.has(fixture.id));
  const nextFixture = pending[0];
  const nextRound = nextFixture
    ? pending.filter(
        (fixture) =>
          phaseOf(fixture) === phaseOf(nextFixture) &&
          fixture.round === nextFixture.round &&
          (phaseOf(fixture) !== 'knockout' ||
            fixture.id.endsWith(':first') === nextFixture.id.endsWith(':first')),
      )
    : [];
  const displayedFixtures = activeTab === 'next' ? nextRound : fixtures;
  const groups = cupGroupTables(state, competition);
  const knockoutReady = state.cups.some(
    (node) => node.competitionId === competition && node.homeId && node.awayId,
  );
  const activeCupStage = cupStage === 'knockout' && !knockoutReady ? 'groups' : cupStage;
  return (
    <>
      <div className="competition-controls panel">
        <div className="competition-filters">
          <div className="competition-selectors">
            <label>
              Temporada
              <Select
                value={state.season}
                onValueChange={(value) => setSelectedSeason(Number(value))}
              >
                {seasons.map((season) => (
                  <Option key={season} value={season}>
                    {season}
                  </Option>
                ))}
              </Select>
            </label>
            <label>
              Competição
              <Select
                value={competition}
                onValueChange={(value) => {
                  setCompetition(value);
                  setCupStage('groups');
                }}
              >
                {COMPETITIONS.filter(
                  (rule) =>
                    rule.id !== 'serie-d' &&
                    (state.fixtures.some((fixture) => fixture.competitionId === rule.id) ||
                      state.cups.some((node) => node.competitionId === rule.id) ||
                      Boolean(state.competitionNotes?.[rule.id]) ||
                      rule.id === competition),
                ).map((rule) => (
                  <Option value={rule.id} key={rule.id}>
                    {rule.name}
                  </Option>
                ))}
              </Select>
            </label>
          </div>
        </div>
        <div className="competition-navigation">
          <div
            className="segmented competition-view-tabs"
            role="group"
            aria-label="Visualização da competição"
          >
            <button
              className={activeTab === 'table' ? 'selected' : ''}
              onClick={() => setTab('table')}
            >
              <Icon name="trophy" size={18} /> Classificação / chaves
            </button>

            <button
              className={activeTab === 'next' ? 'selected' : ''}
              onClick={() => setTab('next')}
            >
              <Icon name="calendar" size={18} /> Próxima rodada
            </button>
            <button
              className={activeTab === 'fixtures' ? 'selected' : ''}
              disabled={!participates}
              title={!participates ? 'Seu clube não participa desta competição' : undefined}
              onClick={() => setTab('fixtures')}
            >
              <Icon name="matches" size={18} /> Jogos do clube
            </button>
          </div>
          <span>Horários de Brasília · Partidas entre 08h e 23h30</span>
        </div>
      </div>
      {state.competitionNotes?.[competition] && (
        <p className="competition-note" role="status">
          {state.competitionNotes[competition]}
          {rule?.regulationUrl && (
            <>
              {' '}
              <a href={rule.regulationUrl} target="_blank" rel="noreferrer">
                Regulamento oficial
              </a>
            </>
          )}
        </p>
      )}
      {activeTab === 'table' && table ? (
        <StandingsTable state={state} table={table} competitionId={competition} clubId={club.id} />
      ) : activeTab === 'table' ? (
        <div className="cup-overview">
          {groups.length > 0 && (
            <div
              className="cup-round-navigation cup-stage-tabs"
              role="group"
              aria-label="Fase da competição"
            >
              <button
                className={activeCupStage === 'groups' ? 'selected' : ''}
                onClick={() => setCupStage('groups')}
              >
                Fase de grupos
              </button>
              <button
                className={activeCupStage === 'knockout' ? 'selected' : ''}
                disabled={!knockoutReady}
                title={!knockoutReady ? 'Confrontos ainda não definidos' : undefined}
                onClick={() => setCupStage('knockout')}
              >
                Mata-mata
              </button>
            </div>
          )}
          {groups.length > 0 && activeCupStage === 'groups' ? (
            <div
              className={`cup-group-tables ${competition === 'libertadores' ? 'libertadores-groups' : ''}`}
            >
              {groups.map(({ group, table }) => (
                <StandingsTable
                  key={group}
                  state={state}
                  table={table}
                  competitionId={competition}
                  clubId={club.id}
                  group={group}
                />
              ))}
            </div>
          ) : (
            <CupBracket state={state} competitionId={competition} clubId={club.id} />
          )}
        </div>
      ) : (
        <section className="panel">
          <div className="section-header">
            <h2>{activeTab === 'next' ? 'Próxima rodada' : `Calendário do ${club.name}`}</h2>
          </div>
          <p className="calendar-home-note">Mandante à esquerda · Visitante à direita</p>
          {[
            { id: 'groups', label: 'Fase de grupos' },
            { id: 'knockout', label: 'Mata-mata' },
            { id: 'league', label: 'Pontos corridos' },
          ].map((phase) => {
            const matches = displayedFixtures.filter((fixture) => phaseOf(fixture) === phase.id);
            if (!matches.length) return null;
            return (
              <section className="calendar-phase" key={phase.id}>
                <h3>{phase.label}</h3>
                <div className="calendar-match-grid">
                  {matches.map((fixture) => {
                    const result = state.results.find((item) => item.fixtureId === fixture.id);
                    return (
                      <article className="calendar-match-card" key={fixture.id}>
                        <header>
                          <time>{dateTime(fixture.scheduledAt)}</time>
                          <span>
                            {fixture.group ? `Grupo ${fixture.group} · ` : ''}
                            {result ? 'Encerrado' : `Rodada ${fixture.round + 1}`}
                          </span>
                        </header>
                        <div className="calendar-match-sides">
                          {(['home', 'away'] as const).map((side) => {
                            const id = side === 'home' ? fixture.homeId : fixture.awayId;
                            const team = state.clubs.byId[id];
                            return (
                              <div
                                key={side}
                                className={`calendar-match-team calendar-match-${side} ${id === club.id ? 'user-team-outline' : ''}`}
                                aria-label={`${side === 'home' ? 'Mandante' : 'Visitante'}: ${team?.name ?? 'Clube'}`}
                              >
                                <PixelBadge
                                  name={team?.name ?? 'Clube'}
                                  {...(team?.crestUrl ? { url: team.crestUrl } : {})}
                                  size={26}
                                />
                                <span>{team?.name}</span>
                                {side === 'home' && (
                                  <strong className="calendar-match-score">
                                    {result ? `${result.homeGoals}–${result.awayGoals}` : '×'}
                                  </strong>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {!displayedFixtures.length && (
            <p className="empty-state">
              {activeTab === 'next'
                ? 'Nenhuma partida pendente com confronto definido nesta competição.'
                : 'Acompanhe os confrontos na aba de chaves desta copa.'}
            </p>
          )}
        </section>
      )}
    </>
  );
}
