import { positionLabel } from '../../ui/position-label';
import { memo } from 'react';
import {
  COMPETITIONS,
  FORMATIONS,
  clubKit,
  type MatchResult,
  type WorldState,
} from '@football/shared';
import { PixelBadge } from '../../ui/pixel-badge';
import { Portrait } from '../players/pixel-portrait';
import { visibleActionMinute } from '../../three/match-playback';

import { liveMatchStatistics, livePlayerRatings, visibleRatingActions } from './live-statistics';

type ReportProps = { state: WorldState; result: MatchResult };
function Badge({ state, id }: { state: WorldState; id: string | undefined }) {
  const club = state.clubs.byId[id ?? ''];
  return (
    <PixelBadge
      name={club?.name ?? 'Clube'}
      {...(club?.crestUrl ? { url: club.crestUrl } : {})}
      size={28}
    />
  );
}

export function RoundResults({
  state,
  result,
  minute,
  onSelect,
  viewerClubId,
}: ReportProps & {
  minute: number;
  onSelect: (id: string, time: number) => void;
  viewerClubId?: string;
}) {
  const fixture = state.fixtures.find((item) => item.id === result.fixtureId);
  const fixtures = new Map(state.fixtures.map((item) => [item.id, item]));
  const cups = new Map(state.cups.map((item) => [item.id, item]));
  const competitionOf = (item: MatchResult) =>
    fixtures.get(item.fixtureId)?.competitionId ??
    cups.get(item.fixtureId.replace(/:first$/, ''))?.competitionId;
  const clubMatch = state.results.find(
    (item) =>
      item.startedAt === result.startedAt &&
      (item.homeId === viewerClubId || item.awayId === viewerClubId),
  );
  const activeCompetitionId = competitionOf(clubMatch ?? result);
  const groups = new Map<string, MatchResult[]>();
  for (const item of state.results.filter((match) => match.startedAt === result.startedAt)) {
    const competitionId = competitionOf(item);
    if (!competitionId || competitionId !== activeCompetitionId) continue;
    const matches = groups.get(competitionId) ?? [];
    matches.push(item);
    groups.set(competitionId, matches);
  }
  const phaseOf = (item: MatchResult) =>
    fixtures.get(item.fixtureId)?.group
      ? 'groups'
      : cups.has(item.fixtureId.replace(/:first$/, ''))
        ? 'knockout'
        : 'league';
  const phases = [
    { id: 'league', label: 'Pontos corridos' },
    { id: 'groups', label: 'Fase de grupos' },
    { id: 'knockout', label: 'Mata-mata' },
  ];
  const competitionOrder = new Map(
    COMPETITIONS.map((competition, index) => [competition.id, index]),
  );
  const orderedGroups = [...groups].sort(
    ([a], [b]) =>
      (competitionOrder.get(a) ?? COMPETITIONS.length) -
      (competitionOrder.get(b) ?? COMPETITIONS.length),
  );
  return (
    <section className="round-results report-dark">
      <header>
        <h2>Placar da rodada</h2>
        {fixture && <span>Rodada {fixture.round}</span>}
      </header>
      {orderedGroups.map(([competitionId, matches]) => (
        <section
          className="round-competition"
          key={competitionId}
          aria-label={
            COMPETITIONS.find((competition) => competition.id === competitionId)?.name ??
            'Outras partidas'
          }
        >
          <header className="round-competition-heading">
            <h3>
              {COMPETITIONS.find((competition) => competition.id === competitionId)?.name ??
                'Outras partidas'}
            </h3>
            <span>{matches.length} jogo(s)</span>
          </header>
          {phases
            .filter((phase) => matches.some((item) => phaseOf(item) === phase.id))
            .map((phase) => (
              <div className="round-phase" key={phase.id}>
                <h4>{phase.label}</h4>
                <div className="round-results-grid">
                  {matches
                    .filter((item) => phaseOf(item) === phase.id)
                    .map((item) => {
                      const goals = item.actions?.filter(
                        (action, index) =>
                          action.type === 'goal' &&
                          visibleActionMinute(item.actions ?? [], index) <= minute,
                      );
                      const ended = minute >= 90;
                      const homeGoals = ended
                        ? item.homeGoals
                        : (goals?.filter((action) => action.side === 'home').length ?? 0);
                      const awayGoals = ended
                        ? item.awayGoals
                        : (goals?.filter((action) => action.side === 'away').length ?? 0);
                      return (
                        <button
                          key={item.fixtureId}
                          className={`round-result-card ${item.fixtureId === result.fixtureId ? 'is-selected' : ''}`}
                          onClick={() => onSelect(item.fixtureId, Date.now())}
                          aria-label={`Ver partida: ${state.clubs.byId[item.homeId ?? '']?.name} × ${state.clubs.byId[item.awayId ?? '']?.name}`}
                        >
                          <span className="round-result-teams">
                            {(['home', 'away'] as const).map((side) => {
                              const id = side === 'home' ? item.homeId : item.awayId;
                              const score = side === 'home' ? homeGoals : awayGoals;
                              const winner =
                                ended && score > (side === 'home' ? awayGoals : homeGoals);
                              return (
                                <span
                                  key={side}
                                  className={`round-result-team ${winner ? 'is-winner' : ''} ${id === viewerClubId ? 'user-team-outline' : ''}`}
                                >
                                  <Badge state={state} id={id} />
                                  <span>{state.clubs.byId[id ?? '']?.name ?? 'Clube'}</span>
                                  <strong>{score}</strong>
                                  <span className="winner-mark" aria-hidden="true">
                                    {winner ? '◂' : ''}
                                  </span>
                                </span>
                              );
                            })}
                          </span>
                          <span className="round-result-status">
                            <strong>{ended ? 'FIM' : `${Math.floor(minute)}′`}</strong>
                            <span>{ended ? 'Encerrado' : 'Ao vivo'}</span>
                            {item.startedAt !== undefined && (
                              <time dateTime={new Date(item.startedAt).toISOString()}>
                                {new Intl.DateTimeFormat('pt-BR', {
                                  day: '2-digit',
                                  month: 'short',
                                  timeZone: 'America/Sao_Paulo',
                                }).format(item.startedAt)}
                              </time>
                            )}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
        </section>
      ))}
    </section>
  );
}

export function MatchStatistics({
  state,
  result,
  viewerClubId,
  minute = 90,
}: ReportProps & { viewerClubId: string; minute?: number }) {
  const statistics = liveMatchStatistics(result, minute);
  const count = (side: 'home' | 'away', type: string) =>
    result.actions
      ? result.actions.filter(
          (action, index) =>
            action.side === side &&
            action.type === type &&
            visibleActionMinute(result.actions ?? [], index) <= minute,
        ).length
      : undefined;
  const rows = [
    ['Chutes', statistics.home.shots, statistics.away.shots],
    ['Chutes no alvo', statistics.home.shotsOnTarget, statistics.away.shotsOnTarget],
    ['Posse (%)', statistics.home.possession, statistics.away.possession],
    ['Passes', statistics.home.passes, statistics.away.passes],
    ['Faltas', statistics.home.fouls, statistics.away.fouls],
    ['Cartões amarelos', count('home', 'yellow'), count('away', 'yellow')],
    ['Cartões vermelhos', count('home', 'red'), count('away', 'red')],
    ['Escanteios', statistics.home.corners, statistics.away.corners],
    ['xG', statistics.home.xg, statistics.away.xg],
  ] as const;
  const homeIsMine = result.awayId !== viewerClubId;
  const homeName = state.clubs.byId[result.homeId ?? '']?.name ?? 'Mandante';
  const awayName = state.clubs.byId[result.awayId ?? '']?.name ?? 'Visitante';
  const format = (value: number | undefined, label: string) =>
    value === undefined
      ? '—'
      : label === 'xG'
        ? value.toFixed(2)
        : `${Math.round(value)}${label === 'Posse (%)' ? '%' : ''}`;
  return (
    <section className="match-statistics report-dark">
      <div className="stat-heading">
        <div className={`stat-team ${homeIsMine ? 'stat-own' : 'stat-opponent'}`}>
          <Badge state={state} id={result.homeId} />
          <span>{homeName}</span>
        </div>
        <h2>{minute >= 90 ? 'Estatísticas finais' : 'Estatísticas ao vivo'}</h2>
        <div className={`stat-team stat-team-away ${homeIsMine ? 'stat-opponent' : 'stat-own'}`}>
          <span>{awayName}</span>
          <Badge state={state} id={result.awayId} />
        </div>
      </div>
      <div className="stat-comparisons">
        {rows.map(([label, home, away]) => {
          const total = (home ?? 0) + (away ?? 0);
          const known = home !== undefined && away !== undefined;
          const homeShare = known && total > 0 ? (home! / total) * 100 : 0;
          const awayShare = known && total > 0 ? 100 - homeShare : 0;
          return (
            <div
              className="stat-comparison"
              key={label}
              role="group"
              aria-label={`${label}: ${homeName} ${format(home, label)}, ${awayName} ${format(away, label)}`}
            >
              <div className="stat-comparison-values">
                <strong className={homeIsMine ? 'stat-own' : 'stat-opponent'}>
                  {format(home, label)}
                </strong>
                <span>{label}</span>
                <strong className={homeIsMine ? 'stat-opponent' : 'stat-own'}>
                  {format(away, label)}
                </strong>
              </div>
              <div className="stat-proportion" aria-hidden="true">
                <span
                  className={homeIsMine ? 'stat-fill-own' : 'stat-fill-opponent'}
                  style={{ width: `${homeShare}%` }}
                />
                <span
                  className={homeIsMine ? 'stat-fill-opponent' : 'stat-fill-own'}
                  style={{ width: `${awayShare}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const PlayerRatings = memo(
  function PlayerRatings({ state, result, minute = 90 }: ReportProps & { minute?: number }) {
    const ratings = livePlayerRatings(result, minute, state.players.byId);
    const visibleActions = visibleRatingActions(result, minute);
    return (
      <section className="match-player-ratings report-dark">
        <header>
          <h2>Notas dos atletas</h2>
          <span>{minute >= 90 ? 'Notas finais' : `Ao vivo · ${Math.floor(minute)}′`}</span>
        </header>
        <div className="ratings-pitch">
          <div className="ratings-pitch-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          {(['home', 'away'] as const).map((side) => {
            const clubId = side === 'home' ? result.homeId : result.awayId;
            const club = state.clubs.byId[clubId ?? ''];
            const ids =
              result.lineups?.[side] ??
              Object.keys(result.ratings ?? {}).filter(
                (id) => state.players.byId[id]?.clubId === clubId,
              );
            const players = ids.flatMap((id) =>
              state.players.byId[id] ? [state.players.byId[id]!] : [],
            );
            const plan = result.tacticalPlans?.[side];
            const slots = plan ? FORMATIONS[plan.formation] : undefined;
            const groups = slots
              ? [...new Set(slots.map((slot) => slot.y))].map((y) =>
                  slots.flatMap((slot, index) => {
                    const player = state.players.byId[plan!.starters[index] ?? ''];
                    return slot.y === y && player ? [player] : [];
                  }),
                )
              : [
                  players.filter((p) => p.position === 'GK'),
                  players.filter((p) => ['LB', 'CB', 'RB'].includes(p.position)),
                  players.filter((p) => ['DM', 'CM', 'AM', 'LM', 'RM'].includes(p.position)),
                  players.filter((p) => ['LW', 'RW', 'ST'].includes(p.position)),
                ];
            const rows = side === 'home' ? groups : [...groups].reverse();
            const teamLabel = (
              <div className="ratings-team-label">
                <Badge state={state} id={clubId} />
                <strong>{club?.name ?? 'Clube'}</strong>
              </div>
            );
            return (
              <div key={side} className={`ratings-half ratings-half-${side}`}>
                {teamLabel}
                <div
                  className="ratings-formation"
                  style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
                >
                  {rows.map((group, index) => (
                    <div key={index} className="ratings-player-row">
                      {group.map((player) => {
                        const rating = ratings[player.id];
                        const actions = visibleActions.filter(
                          (action) => action.playerId === player.id,
                        );
                        const goals = actions.filter((action) => action.type === 'goal').length;
                        const red = actions.some((action) => action.type === 'red');
                        const yellow = actions.some((action) => action.type === 'yellow');
                        return (
                          <div
                            key={player.id}
                            className="rated-player"
                            title={`${player.name} · ${positionLabel(player.position)} · Nota ${rating?.toFixed(1) ?? 'indisponível'}`}
                          >
                            <div className="rated-player-portrait">
                              <Portrait
                                player={player}
                                clubName={club?.name}
                                kit={clubKit(club ?? { name: '' })}
                              />
                              {(red || yellow) && (
                                <span
                                  className={`rating-card ${red ? 'red' : 'yellow'}`}
                                  aria-label={red ? 'Cartão vermelho' : 'Cartão amarelo'}
                                />
                              )}
                              {goals > 0 && (
                                <span className="rating-goals" aria-label={`${goals} gol(s)`}>
                                  ⚽{goals > 1 ? goals : ''}
                                </span>
                              )}
                            </div>
                            <strong
                              className={`player-rating-chip ${rating === undefined ? 'unrated' : rating >= 7 ? 'good' : rating >= 5 ? 'average' : 'poor'}`}
                            >
                              {rating?.toFixed(1) ?? '—'}
                            </strong>
                            <span className="rated-player-name">
                              {player.shirtNumber} {player.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {players.length === 0 && <p>Escalação indisponível.</p>}
              </div>
            );
          })}
        </div>
        <p className="ratings-key">
          Notas: <span>7–10</span> boa · 5–6,9 regular · abaixo de 5 baixa
        </p>
      </section>
    );
  },
  (previous, next) =>
    previous.state === next.state &&
    previous.result === next.result &&
    Math.floor((previous.minute ?? 90) * 2) === Math.floor((next.minute ?? 90) * 2),
);
export function GoalsAndCards({ state, result, minute }: ReportProps & { minute: number }) {
  const events = (result.actions ?? []).filter(
    (action, index) =>
      ['goal', 'yellow', 'red'].includes(action.type) &&
      visibleActionMinute(result.actions ?? [], index) <= minute,
  );
  return (
    <section className="goals-cards report-dark">
      <header>
        <h2>Gols e cartões</h2>
        <span>{events.length} ocorrência(s)</span>
      </header>
      {events.length === 0 ? (
        <p className="events-empty">
          Nenhum gol ou cartão registrado{minute < 90 ? ' até o momento' : ''}.
        </p>
      ) : (
        <ol className="match-event-list">
          {events.map((action, index) => (
            <li key={index} className={`match-event-item event-${action.side}`}>
              <time>{Math.ceil(action.minute)}′</time>
              <span
                className={`event-symbol event-symbol-${action.type}`}
                aria-label={
                  action.type === 'goal'
                    ? 'Gol'
                    : action.type === 'red'
                      ? 'Cartão vermelho'
                      : 'Cartão amarelo'
                }
              >
                {action.type === 'goal' ? '⚽' : ''}
              </span>
              <div>
                <strong>{state.players.byId[action.playerId ?? '']?.name ?? 'Jogador'}</strong>
                <span>
                  {action.type === 'goal'
                    ? 'Gol'
                    : action.type === 'red'
                      ? 'Cartão vermelho'
                      : 'Cartão amarelo'}{' '}
                  ·{' '}
                  {state.clubs.byId[(action.side === 'home' ? result.homeId : result.awayId) ?? '']
                    ?.name ?? 'Clube'}
                </span>
                {action.assistId && (
                  <span>Assistência: {state.players.byId[action.assistId]?.name ?? 'Jogador'}</span>
                )}
              </div>
              <Badge state={state} id={action.side === 'home' ? result.homeId : result.awayId} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
