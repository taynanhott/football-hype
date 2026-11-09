import { useFinishedResults } from '../../ui/use-finished-results';
import { CompetitionDrawCard } from './competition-draw-details';
import { cupReturnDate, REGIONAL_QUALIFIERS } from '@football/domain';
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
  const liveState = useFinishedResults(snapshot.state);
  const [competition, setCompetition] = useState(() => {
    const requested = new URLSearchParams(location.hash.split('?')[1] ?? '').get('competition');
    if (
      requested &&
      (COMPETITIONS.some((item) => item.id === requested) ||
        REGIONAL_QUALIFIERS.some((item) => item.id === requested))
    )
      return requested;
    return club.division === 'REGIONAL' ? 'serie-a' : `serie-${club.division.toLowerCase()}`;
  });
  const parentCompetition =
    REGIONAL_QUALIFIERS.find((q) => q.id === competition)?.cupId ??
    (competition === 'pre-libertadores' ? 'libertadores' : competition);
  const preliminary = REGIONAL_QUALIFIERS.find((q) => q.cupId === parentCompetition);
  const [tab, setTab] = useState('table');
  const [cupStage, setCupStage] = useState('groups');
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [roundSelection, setRoundSelection] = useState<{ scope: string; key: string } | null>(null);
  const archive = snapshot.state.seasonArchives?.find((item) => item.season === selectedSeason);
  const state = archive
    ? { ...snapshot.state, competitionNotes: undefined, ...archive }
    : liveState;
  const seasons = [
    snapshot.state.season,
    ...(snapshot.state.seasonArchives ?? []).map((item) => item.season),
  ].sort((a, b) => b - a);
  const rule = COMPETITIONS.find((item) => item.id === competition);
  const qualifierRule = REGIONAL_QUALIFIERS.find((q) => q.id === competition);
  const qualifier = (archive ? archive.regionalQualifiers : state.regionalQualifiers)?.find(
    (q) => q.competitionId === competition,
  );
  const table = qualifier
    ? standings(
        qualifier.candidateIds,
        state.fixtures.filter((f) => f.competitionId === competition),
        state.results,
      )
    : archive
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
  const roundKey = (fixture: Fixture) =>
    `${phaseOf(fixture)}:${fixture.round}:${phaseOf(fixture) === 'knockout' && fixture.id.endsWith(':first') ? 'first' : 'last'}`;
  const rounds = [
    ...new Map(competitionFixtures.map((fixture) => [roundKey(fixture), fixture])).values(),
  ];
  const roundScope = `${competition}:${selectedSeason ?? state.season}`;
  const defaultRound = nextFixture
    ? roundKey(nextFixture)
    : rounds.at(-1)
      ? roundKey(rounds.at(-1)!)
      : '';
  const selectedRoundKey = roundSelection?.scope === roundScope ? roundSelection.key : defaultRound;
  const selectedRoundIndex = Math.max(
    0,
    rounds.findIndex((fixture) => roundKey(fixture) === selectedRoundKey),
  );
  const selectedRound = rounds[selectedRoundIndex];
  const displayedFixtures =
    activeTab === 'next'
      ? competitionFixtures.filter(
          (fixture) => selectedRound && roundKey(fixture) === roundKey(selectedRound),
        )
      : fixtures;
  const navigateRound = (index: number) => {
    const fixture = rounds[index];
    if (fixture) setRoundSelection({ scope: roundScope, key: roundKey(fixture) });
  };
  const pendingDraw = !archive
    ? state.competitionDraws?.find(
        (draw) => draw.competitionId === competition && draw.completedAt === undefined,
      )
    : undefined;
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
                className="competition-season-select"
                menuMinWidth={136}
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
                value={parentCompetition}
                onValueChange={(value) => {
                  setCompetition(value);
                  setCupStage('groups');
                }}
              >
                {COMPETITIONS.filter(
                  (rule) =>
                    rule.id !== 'pre-libertadores' &&
                    (state.fixtures.some((fixture) => fixture.competitionId === rule.id) ||
                      state.cups.some((node) => node.competitionId === rule.id) ||
                      Boolean(state.competitionNotes?.[rule.id]) ||
                      rule.id === parentCompetition),
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
              <Icon name="trophy" size={18} /> Classificação
            </button>

            <button
              className={activeTab === 'next' ? 'selected' : ''}
              disabled={Boolean(pendingDraw)}
              title={pendingDraw ? 'Disponível após o sorteio' : undefined}
              onClick={() => setTab('next')}
            >
              <Icon name="calendar" size={18} /> Partidas
            </button>
            <button
              className={activeTab === 'fixtures' ? 'selected' : ''}
              disabled={Boolean(pendingDraw) || !participates}
              title={
                pendingDraw
                  ? 'Disponível após o sorteio'
                  : !participates
                    ? 'Seu clube não participa desta competição'
                    : undefined
              }
              onClick={() => setTab('fixtures')}
            >
              <Icon name="matches" size={18} /> Jogos do clube
            </button>
          </div>
        </div>
      </div>
      {(preliminary || parentCompetition === 'libertadores') && (
        <div
          className="cup-round-navigation cup-stage-tabs"
          role="group"
          aria-label="Etapa da competição"
        >
          <button
            className={competition !== parentCompetition ? 'selected' : ''}
            onClick={() => setCompetition(preliminary?.id ?? 'pre-libertadores')}
          >
            {preliminary?.name ?? 'Pré-Libertadores'}
          </button>
          <button
            className={competition === parentCompetition ? 'selected' : ''}
            onClick={() => setCompetition(parentCompetition)}
          >
            Competição principal
          </button>
        </div>
      )}
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
      {qualifierRule && !qualifier ? null : pendingDraw ? (
        <CompetitionDrawCard state={state} draw={pendingDraw} />
      ) : activeTab === 'table' && table ? (
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
              className={`cup-group-tables ${competition === 'europa' ? 'european-groups' : ''} ${['libertadores', 'sul-americana', 'copa-nordeste', 'copa-verde', 'copa-sul-sudeste'].includes(competition) && groups.length === 4 ? 'libertadores-groups four-group-layout' : ''}`}
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
        <section className="panel tournament-matches">
          <div className="section-header">
            <h2>{activeTab === 'next' ? 'Partidas' : `Calendário do ${club.name}`}</h2>
            {activeTab === 'next' && rounds.length > 0 && (
              <div className="tournament-round-navigation" aria-label="Navegar entre rodadas">
                <button
                  type="button"
                  aria-label="Rodada anterior"
                  disabled={selectedRoundIndex === 0}
                  onClick={() => navigateRound(selectedRoundIndex - 1)}
                >
                  ‹
                </button>
                <Select
                  aria-label="Rodada"
                  value={String(selectedRoundIndex)}
                  onValueChange={(value) => navigateRound(Number(value))}
                >
                  {rounds.map((fixture, index) => (
                    <Option key={roundKey(fixture)} value={String(index)}>
                      {phaseOf(fixture) === 'groups'
                        ? 'Grupos · '
                        : phaseOf(fixture) === 'knockout'
                          ? 'Mata-mata · '
                          : ''}
                      Rodada {fixture.round + 1}
                      {phaseOf(fixture) === 'knockout'
                        ? fixture.id.endsWith(':first')
                          ? ' · Ida'
                          : ' · Volta / único'
                        : ''}
                    </Option>
                  ))}
                </Select>
                <button
                  type="button"
                  aria-label="Rodada seguinte"
                  disabled={selectedRoundIndex >= rounds.length - 1}
                  onClick={() => navigateRound(selectedRoundIndex + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
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
                      <article
                        className="calendar-match-card"
                        data-finished={Boolean(result)}
                        key={fixture.id}
                      >
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
                                className={`calendar-match-side calendar-match-side-${side}`}
                                key={side}
                              >
                                <div
                                  className={`calendar-match-team calendar-match-${side} ${id === club.id ? 'user-team-outline' : ''}`}
                                  aria-label={`${side === 'home' ? 'Mandante' : 'Visitante'}: ${team?.name ?? 'Clube'}`}
                                >
                                  <PixelBadge
                                    name={team?.name ?? 'Clube'}
                                    {...(team?.crestUrl ? { url: team.crestUrl } : {})}
                                    size={26}
                                  />
                                  <span className="calendar-match-team-name">{team?.name}</span>
                                  {state.participants.some(
                                    (participant) => participant.clubId === id,
                                  ) && (
                                    <span
                                      className="calendar-human-manager"
                                      title="Clube treinado por jogador real"
                                      aria-label="Clube treinado por jogador real"
                                    >
                                      <Icon name="squad" size={13} />
                                    </span>
                                  )}
                                </div>
                                {side === 'home' && (
                                  <strong className="calendar-match-score">
                                    {result ? (
                                      <>
                                        <span>{result.homeGoals}</span>
                                        <span className="calendar-score-separator">×</span>
                                        <span>{result.awayGoals}</span>
                                      </>
                                    ) : (
                                      '×'
                                    )}
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
