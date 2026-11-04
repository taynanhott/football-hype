import { useFinishedResults } from '../../ui/use-finished-results';
import { CompetitionDrawDetails } from './competition-draw-details';
import {
  clubCalendarCurrentTime,
  clubCalendarFixtures,
  clubCalendarPendingGames,
} from './club-calendar-fixtures';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { clubDayRoutine, pendingFixtures, realFixtureTime } from '@football/domain';
import { COMPETITIONS, clubKit, type Fixture, type WorldState } from '@football/shared';
import { Portrait } from '../players/pixel-portrait';
import { positionLabel } from '../../ui/position-label';
import { fifaCalendarBoundary } from './fifa-calendar';
import { PlayerModal } from '../players/player-modal';
import { PixelBadge } from '../../ui/pixel-badge';
import { dateTime } from '../../ui/format';
import { Icon } from '../../ui/icons';
import { GameDetails } from './game-details';

const palette = [
  '#6665eb',
  '#5589eb',
  '#a2be22',
  '#bc9b26',
  '#5a96c6',
  '#279b6d',
  '#d89835',
  '#b35a81',
];
const competitionColor = (id: string) =>
  palette[
    Math.max(
      0,
      COMPETITIONS.findIndex((rule) => rule.id === id),
    ) % palette.length
  ]!;
const dayKey = (timestamp: number) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp);
const drawThemes: Record<string, { label: string; color: string; surface: string; ink: string }> = {
  'copa-brasil': { label: 'Copa do Brasil', color: '#239358', surface: '#e1efdf', ink: '#185134' },
  libertadores: { label: 'Liberta', color: '#bd9635', surface: '#f4e9be', ink: '#604918' },
  'pre-libertadores': {
    label: 'Pré-Liberta',
    color: '#8c7445',
    surface: '#eae3d2',
    ink: '#594522',
  },
  'sul-americana': { label: 'Sul-Americana', color: '#6785a3', surface: '#e5edf4', ink: '#304f6b' },
  'copa-sul-sudeste': {
    label: 'Sul-Sudeste',
    color: '#c34f55',
    surface: '#f5e2e2',
    ink: '#81323a',
  },
  'copa-nordeste': { label: 'Nordeste', color: '#d29324', surface: '#faedce', ink: '#805713' },
  'copa-verde': { label: 'Copa Verde', color: '#24867b', surface: '#deefea', ink: '#175a51' },
};
const routines = {
  training: { label: 'Treino', icon: 'training', color: '#d77c25' },
  recovery: { label: 'Recup.', icon: 'recovery', color: '#d45252' },
  rest: { label: 'Folga', icon: '♧', color: '#28765d' },
  eve: { label: 'Véspera', icon: '◷', color: '#8051b5' },
};

export function ClubCalendar({ state: rawState, clubId }: { state: WorldState; clubId: string }) {
  const state = useFinishedResults(rawState);
  const [selectedFifa, setSelectedFifa] = useState<ReturnType<typeof fifaCalendarBoundary>>();
  const [pendingGame, setPendingGame] = useState<
    ReturnType<typeof clubCalendarPendingGames>[number] | null
  >(null);
  const [selectedDrawId, setSelectedDrawId] = useState<string | null>(null);
  const selectedDraw = state.competitionDraws?.find((draw) => draw.id === selectedDrawId);
  const fixtures = clubCalendarFixtures(state, clubId);
  const completedIds = new Set(state.results.map((result) => result.fixtureId));
  const today = dayKey(clubCalendarCurrentTime(state, fixtures, completedIds));
  const [selectedGame, setSelectedGame] = useState<Fixture | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const [viewedMonth, setViewedMonth] = useState<{ day: string; date: Date } | null>(null);
  const month = viewedMonth?.day === today ? viewedMonth.date : new Date(`${today}T12:00:00Z`);
  const pendingGames = clubCalendarPendingGames(state, clubId);
  const missedGames = selectedFifa
    ? fixtures.filter((fixture) => {
        const day = dayKey(fixture.scheduledAt);
        return (
          day >= selectedFifa.start && day <= selectedFifa.end && !completedIds.has(fixture.id)
        );
      }).length
    : 0;
  const returnDate = selectedFifa
    ? new Date(new Date(`${selectedFifa.end}T12:00:00Z`).getTime() + 86400000).toLocaleDateString(
        'pt-BR',
        { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' },
      )
    : '';
  const year = month.getUTCFullYear(),
    monthIndex = month.getUTCMonth();
  const offset = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();

  const cells = 42;
  const competitions = [...new Set(fixtures.map((fixture) => fixture.competitionId))];
  const moveMonth = (delta: number) =>
    setViewedMonth({ day: today, date: new Date(Date.UTC(year, monthIndex + delta, 1, 12)) });
  return (
    <>
      <section
        className="club-calendar"
        aria-labelledby="club-calendar-title"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          swipeStart.current =
            event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchCancel={() => {
          swipeStart.current = null;
        }}
        onTouchEnd={(event) => {
          const start = swipeStart.current,
            touch = event.changedTouches[0];
          swipeStart.current = null;
          if (!start || !touch || event.touches.length) return;
          const dx = touch.clientX - start.x,
            dy = touch.clientY - start.y;
          if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy) * 1.4) return;
          suppressClickUntil.current = event.timeStamp + 400;
          moveMonth(dx < 0 ? 1 : -1);
        }}
        onClickCapture={(event) => {
          if (event.timeStamp < suppressClickUntil.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <header className="club-calendar-heading">
          <div>
            <h2 id="club-calendar-title">
              <span className="calendar-title-month">
                {new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(month)}
              </span>{' '}
              <span className="calendar-title-year">de {year}</span>
            </h2>
          </div>
          <button className="club-calendar-today" onClick={() => setViewedMonth(null)}>
            Hoje
          </button>
        </header>
        <nav className="club-calendar-month-navigation" aria-label="Navegar pelos meses">
          <button
            type="button"
            aria-label="Mês anterior"
            title="Mês anterior"
            onClick={() => moveMonth(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            title="Próximo mês"
            onClick={() => moveMonth(1)}
          >
            ›
          </button>
        </nav>
        <div className="club-calendar-weekdays">
          {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div
          className="club-calendar-grid"
          style={{ '--calendar-weeks': cells / 7 } as CSSProperties}
        >
          {Array.from({ length: cells }, (_, index) => {
            const date = new Date(Date.UTC(year, monthIndex, index - offset + 1, 12));
            const key = date.toISOString().slice(0, 10);
            const inMonth = date.getUTCMonth() === monthIndex;
            const fifaBoundary = inMonth ? fifaCalendarBoundary(key) : undefined;
            const drawOnDay = (state.competitionDraws ?? []).filter(
              (draw) => draw.participantIds.includes(clubId) && dayKey(draw.scheduledAt) === key,
            );
            const matches = fixtures.filter((fixture) => dayKey(fixture.scheduledAt) === key);
            const cupId =
              matches[0]?.competitionId ??
              pendingGames.find((game) => dayKey(game.scheduledAt) === key)?.competitionId;
            const pendingOnDay = pendingGames.find((game) => dayKey(game.scheduledAt) === key);
            const openDay = () => {
              if (matches[0]) setSelectedGame(matches[0]);
              else if (drawOnDay[0]) setSelectedDrawId(drawOnDay[0].id);
              else if (pendingOnDay) setPendingGame(pendingOnDay);
            };
            const activity = clubDayRoutine(fixtures, clubId, date.getTime());
            const routine = activity === 'match' ? routines.training : routines[activity];
            return (
              <div
                key={key}
                className={`club-calendar-day ${!inMonth ? 'outside-month' : ''} ${matches.length ? 'match-day' : routine === routines.recovery ? 'recovery-day' : routine === routines.training ? 'training-day' : ''} ${key === today ? 'is-today' : ''}`}
                aria-current={key === today ? 'date' : undefined}
                onClick={(event) => {
                  if (!inMonth || (event.target as HTMLElement).closest('button')) return;
                  if (matches[0]) setSelectedGame(matches[0]);
                  else if (drawOnDay[0]) setSelectedDrawId(drawOnDay[0].id);
                  else {
                    const game = pendingGames.find((item) => dayKey(item.scheduledAt) === key);
                    if (game) setPendingGame(game);
                  }
                }}
                data-routine={inMonth && !cupId && drawOnDay.length === 0 ? activity : undefined}
                data-cup-day={inMonth ? cupId : undefined}
                style={
                  {
                    '--cup-accent': cupId
                      ? (drawThemes[cupId]?.color ?? competitionColor(cupId))
                      : undefined,
                    '--cup-light': cupId ? (drawThemes[cupId]?.surface ?? '#e1efdf') : undefined,
                    '--day-color': matches[0]
                      ? competitionColor(matches[0].competitionId)
                      : routine.color,
                    ...(drawOnDay[0] && drawThemes[drawOnDay[0].competitionId]
                      ? {
                          '--draw-color': drawThemes[drawOnDay[0].competitionId]!.color,
                          '--draw-surface': drawThemes[drawOnDay[0].competitionId]!.surface,
                          '--draw-ink': drawThemes[drawOnDay[0].competitionId]!.ink,
                        }
                      : {}),
                  } as CSSProperties
                }
              >
                {(matches.length > 0 || drawOnDay.length > 0 || pendingOnDay) && (
                  <button
                    type="button"
                    className="calendar-day-hit-area"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={openDay}
                  />
                )}
                <time dateTime={key}>{date.getUTCDate()}</time>
                {fifaBoundary &&
                  (fifaBoundary.kind === 'Início' ? (
                    <button
                      type="button"
                      className={`calendar-fifa-event ${matches.length || drawOnDay.length || pendingOnDay ? 'compact' : ''}`}
                      aria-label="Início da Data FIFA · Ver convocados"
                      title="Início da Data FIFA · Ver convocados"
                      onClick={() => setSelectedFifa(fifaBoundary)}
                    >
                      <span>Início</span>
                      <strong>Data FIFA</strong>
                    </button>
                  ) : (
                    <span
                      className={`calendar-fifa-event ${matches.length || drawOnDay.length || pendingOnDay ? 'compact' : ''}`}
                      aria-label="Fim da Data FIFA"
                      title="Último dia da Data FIFA"
                    >
                      <span>Fim</span>
                      <strong>Data FIFA</strong>
                    </span>
                  ))}
                {inMonth &&
                  pendingGames
                    .filter((game) => dayKey(game.scheduledAt) === key)
                    .map((game) => (
                      <button
                        type="button"
                        className="club-calendar-event calendar-pending-event calendar-cup-event"
                        style={
                          {
                            '--cup-accent':
                              drawThemes[game.competitionId]?.color ??
                              competitionColor(game.competitionId),
                            '--cup-light': drawThemes[game.competitionId]?.surface ?? '#e1efdf',
                          } as CSSProperties
                        }
                        key={game.id}
                        title={`${COMPETITIONS.find((rule) => rule.id === game.competitionId)?.name} · ${game.label} · ${dateTime(game.scheduledAt)}`}
                        onClick={() => setPendingGame(game)}
                      >
                        <Icon name="trophy" size={14} />
                        <strong>
                          {game.competitionId === 'libertadores'
                            ? 'Liberta'
                            : COMPETITIONS.find((rule) => rule.id === game.competitionId)?.name}
                        </strong>
                        <small>Adversário a definir</small>
                        <small>{game.label}</small>
                      </button>
                    ))}
                {inMonth &&
                  drawOnDay.map((draw) => (
                    <button
                      key={draw.id}
                      className="calendar-draw-event"
                      type="button"
                      aria-label={
                        'Abrir sorteio de ' +
                        (COMPETITIONS.find((r) => r.id === draw.competitionId)?.name ??
                          draw.competitionId) +
                        ', ' +
                        dateTime(draw.scheduledAt)
                      }
                      title={`Sorteio · ${COMPETITIONS.find((r) => r.id === draw.competitionId)?.name ?? draw.competitionId}`}
                      onClick={() => setSelectedDrawId(draw.id)}
                    >
                      <span className="calendar-draw-label">
                        <strong className="calendar-draw-name">
                          {drawThemes[draw.competitionId]?.label ??
                            COMPETITIONS.find((r) => r.id === draw.competitionId)?.name ??
                            draw.competitionId}
                        </strong>
                      </span>
                    </button>
                  ))}
                {inMonth &&
                  drawOnDay.length === 0 &&
                  (matches.length ? (
                    matches.slice(0, 1).map((fixture) => {
                      const home = fixture.homeId === clubId;
                      const opponent = state.clubs.byId[home ? fixture.awayId : fixture.homeId];
                      const result = state.results.find((item) => item.fixtureId === fixture.id);
                      const competition = COMPETITIONS.find(
                        (item) => item.id === fixture.competitionId,
                      );
                      return (
                        <button
                          type="button"
                          className="club-calendar-event"
                          data-competition={fixture.competitionId}
                          style={
                            {
                              '--cup-accent':
                                drawThemes[fixture.competitionId]?.color ??
                                competitionColor(fixture.competitionId),
                              '--cup-light':
                                drawThemes[fixture.competitionId]?.surface ?? '#e1efdf',
                            } as CSSProperties
                          }
                          key={fixture.id}
                          onClick={() => setSelectedGame(fixture)}
                          aria-label={`${matches.length} jogo(s) neste dia. Use as setas do modal para navegar. Detalhes: ${state.clubs.byId[fixture.homeId]?.name ?? 'Mandante'} contra ${state.clubs.byId[fixture.awayId]?.name ?? 'Visitante'}, ${dateTime(fixture.scheduledAt)}`}
                          title={`${home ? 'Casa' : 'Fora'} · ${opponent?.name ?? 'A definir'} · ${competition?.name} · ${dateTime(fixture.scheduledAt)}`}
                        >
                          <PixelBadge
                            name={opponent?.name ?? 'A definir'}
                            {...(opponent?.crestUrl ? { url: opponent.crestUrl } : {})}
                            size={14}
                          />
                          <strong className="calendar-draw-name">
                            {matches.length > 1 ? (
                              <span>{matches.length} jogos ›</span>
                            ) : (
                              <>
                                <span className="calendar-match-location">
                                  {home ? 'Casa' : 'Fora'}{' '}
                                </span>
                                <span>{opponent?.abbreviation ?? 'TBD'}</span>
                              </>
                            )}
                          </strong>
                          <small>{competition?.name ?? fixture.competitionId}</small>
                          {result && (
                            <b
                              className="club-calendar-score"
                              aria-label={`Placar: ${result.homeGoals} a ${result.awayGoals}`}
                            >
                              {result.homeGoals}–{result.awayGoals}
                            </b>
                          )}
                        </button>
                      );
                    })
                  ) : fifaBoundary ||
                    pendingGames.some((game) => dayKey(game.scheduledAt) === key) ? null : (
                    <>
                      <span className="club-calendar-routine-icon" aria-hidden="true">
                        {routine === routines.training || routine === routines.recovery ? (
                          <Icon name={routine.icon} size={12} />
                        ) : (
                          routine.icon
                        )}
                      </span>
                      <strong className="club-calendar-routine">{routine.label}</strong>
                    </>
                  ))}
              </div>
            );
          })}
        </div>
        <div className="club-calendar-legend">
          <span>
            <i style={{ background: '#397bb3' }} /> Data FIFA
          </span>
          {competitions.map((id) => (
            <span key={id}>
              <i style={{ background: competitionColor(id) }} />
              {COMPETITIONS.find((rule) => rule.id === id)?.name ?? id}
            </span>
          ))}
          {Object.values(routines).map((item) => (
            <span key={item.label}>
              <i style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </section>
      {selectedFifa && (
        <PlayerModal
          title="Convocados · Data FIFA"
          onClose={() => setSelectedFifa(undefined)}
          className="calendar-fifa-modal"
        >
          <div className="calendar-fifa-summary">
            <span>
              <Icon name="calendar" size={16} /> Retorno ao clube <strong>{returnDate}</strong>
            </span>
            <span>
              <Icon name="matches" size={16} />
              <strong>{missedGames}</strong>{' '}
              {missedGames === 1 ? 'jogo agendado' : 'jogos agendados'} no período
            </span>
          </div>
          <ul className="calendar-fifa-players">
            {state.clubs.byId[clubId]?.playerIds.flatMap((id) => {
              const player = state.players.byId[id];
              return player && player.overall >= 80
                ? [
                    <li key={id}>
                      <span className="calendar-callup-portrait">
                        <Portrait
                          player={player}
                          clubName={state.clubs.byId[clubId]?.name}
                          kit={clubKit(state.clubs.byId[clubId] ?? { name: '' })}
                        />
                      </span>
                      <span className="calendar-callup-info">
                        <strong>{player.name}</strong>
                        <small>{positionLabel(player.position)} · Convocado</small>
                        <span className="calendar-callup-absence">
                          {missedGames
                            ? `Fora de ${missedGames} ${missedGames === 1 ? 'jogo agendado' : 'jogos agendados'}`
                            : 'Sem jogos agendados no período'}
                        </span>
                      </span>
                      <span
                        className="calendar-callup-overall market-overall-badge"
                        aria-label={`Overall ${player.overall}`}
                        data-tier={player.overall <= 85 ? 'gold' : 'diamond'}
                      >
                        <small>OVR</small>
                        <strong>{player.overall}</strong>
                      </span>
                    </li>,
                  ]
                : [];
            })}
          </ul>
          {!state.clubs.byId[clubId]?.playerIds.some(
            (id) => (state.players.byId[id]?.overall ?? 0) >= 80,
          ) && <p>Nenhum jogador convocado.</p>}
        </PlayerModal>
      )}
      {selectedDraw && (
        <CompetitionDrawDetails
          state={state}
          draw={selectedDraw}
          onClose={() => setSelectedDrawId(null)}
        />
      )}
      {pendingGame && (
        <PendingGameDetails state={state} game={pendingGame} onClose={() => setPendingGame(null)} />
      )}
      {selectedGame && (
        <GameDetails
          state={state}
          fixture={selectedGame}
          clubId={clubId}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </>
  );
}

function PendingGameDetails({
  state,
  game,
  onClose,
}: {
  state: WorldState;
  game: ReturnType<typeof clubCalendarPendingGames>[number];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => openModalPreservingScroll(dialog.current), []);
  const competition = COMPETITIONS.find((rule) => rule.id === game.competitionId);
  const theme = drawThemes[game.competitionId];
  const date = new Date(game.scheduledAt);
  const pending = pendingFixtures(state);
  const reference = pending.find(
    (f) => f.competitionId === game.competitionId && f.scheduledAt === game.scheduledAt,
  );
  const realAt = reference ? realFixtureTime(state, pending, reference) : undefined;
  const [now] = useState(() => Date.now());
  const tomorrow = now + 86400000;
  const realLabel =
    realAt === undefined
      ? 'Horário real a definir'
      : `${dayKey(realAt) === dayKey(now) ? 'Hoje' : dayKey(realAt) === dayKey(tomorrow) ? 'Amanhã' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).format(realAt)} · ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(realAt)}`;
  const phase = game.label
    .split(' · ')
    .filter(
      (part) => !['Adversário a definir', 'Aguardando sorteio', 'Se classificar'].includes(part),
    )
    .join(' · ');
  const status = game.label.includes('Se classificar')
    ? 'Se classificar'
    : game.label.includes('sorteio')
      ? 'Aguardando sorteio'
      : 'Aguardando fase anterior';
  return (
    <dialog
      ref={dialog}
      className="calendar-pending-dialog"
      aria-label={`${competition?.name} · ${dateTime(game.scheduledAt)}`}
      style={
        {
          '--cup-accent': theme?.color ?? competitionColor(game.competitionId),
          '--cup-light': theme?.surface ?? '#e1efdf',
        } as CSSProperties
      }
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header>
        <span className="pending-cup-emblem">
          <Icon name="trophy" size={28} />
        </span>
        <div>
          <small className="pending-cup-kicker">CALENDÁRIO DA COPA</small>
          <h2>{competition?.name ?? game.competitionId}</h2>
        </div>
        <button type="button" aria-label="Fechar" onClick={onClose}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div className="pending-cup-body">
        <time className="pending-cup-date" dateTime={date.toISOString()}>
          <b>
            {new Intl.DateTimeFormat('pt-BR', {
              day: '2-digit',
              timeZone: 'America/Sao_Paulo',
            }).format(date)}
          </b>
          <span>
            {new Intl.DateTimeFormat('pt-BR', {
              month: 'short',
              year: 'numeric',
              timeZone: 'America/Sao_Paulo',
            }).format(date)}
          </span>
          <strong>No jogo</strong>
        </time>
        <div className="pending-cup-match">
          <span className="pending-cup-phase">{phase || 'Sorteio pendente'}</span>
          <h3>
            Adversário
            <br />a definir
          </h3>
          <span className="pending-cup-status">{status}</span>
          <p className="pending-real-time">
            {realLabel}
            <small>Data e horário reais · Brasília</small>
          </p>
        </div>
        <span className="pending-cup-watermark" aria-hidden="true">
          <Icon name="trophy" size={130} />
        </span>
      </div>
      <button type="button" className="modal-return" aria-label="Voltar" onClick={onClose}>
        ← Voltar
      </button>
    </dialog>
  );
}
