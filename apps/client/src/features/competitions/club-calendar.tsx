import { clubCalendarFixtures } from './club-calendar-fixtures';
import { useState, type CSSProperties } from 'react';
import { clubDayRoutine } from '@football/domain';
import { COMPETITIONS, type Fixture, type WorldState } from '@football/shared';
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
const routines = {
  training: { label: 'Treino', icon: 'training', color: '#d77c25' },
  recovery: { label: 'Recup.', icon: 'recovery', color: '#d45252' },
  rest: { label: 'Folga', icon: '♧', color: '#28765d' },
  eve: { label: 'Véspera', icon: '◷', color: '#977618' },
};

export function ClubCalendar({ state, clubId }: { state: WorldState; clubId: string }) {
  const today = dayKey(state.lastProcessedAt);
  const [selectedGame, setSelectedGame] = useState<Fixture | null>(null);
  const [viewedMonth, setViewedMonth] = useState<{ day: string; date: Date } | null>(null);
  const month = viewedMonth?.day === today ? viewedMonth.date : new Date(`${today}T12:00:00Z`);
  const fixtures = clubCalendarFixtures(state, clubId);
  const year = month.getUTCFullYear(),
    monthIndex = month.getUTCMonth();
  const offset = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells = Math.ceil((offset + days) / 7) * 7;
  const competitions = [...new Set(fixtures.map((fixture) => fixture.competitionId))];
  const moveMonth = (delta: number) =>
    setViewedMonth({ day: today, date: new Date(Date.UTC(year, monthIndex + delta, 1, 12)) });
  return (
    <>
      <section className="club-calendar" aria-labelledby="club-calendar-title">
        <header className="club-calendar-heading">
          <button aria-label="Mês anterior" onClick={() => moveMonth(-1)}>
            ‹
          </button>
          <div>
            <h2 id="club-calendar-title">
              {new Intl.DateTimeFormat('pt-BR', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(month)}
            </h2>
            <p>calendário do jogo</p>
          </div>
          <button aria-label="Próximo mês" onClick={() => moveMonth(1)}>
            ›
          </button>
        </header>
        <div className="club-calendar-weekdays">
          {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="club-calendar-grid">
          {Array.from({ length: cells }, (_, index) => {
            const date = new Date(Date.UTC(year, monthIndex, index - offset + 1, 12));
            const key = date.toISOString().slice(0, 10);
            const inMonth = date.getUTCMonth() === monthIndex;
            const matches = fixtures.filter((fixture) => dayKey(fixture.scheduledAt) === key);
            const activity = clubDayRoutine(fixtures, clubId, date.getTime());
            const routine = activity === 'match' ? routines.training : routines[activity];
            return (
              <div
                key={key}
                className={`club-calendar-day ${!inMonth ? 'outside-month' : ''} ${matches.length ? 'match-day' : routine === routines.recovery ? 'recovery-day' : routine === routines.training ? 'training-day' : ''} ${key === today ? 'is-today' : ''}`}
                aria-current={key === today ? 'date' : undefined}
                style={
                  {
                    '--day-color': matches[0]
                      ? competitionColor(matches[0].competitionId)
                      : routine.color,
                  } as CSSProperties
                }
              >
                <time dateTime={key}>{date.getUTCDate()}</time>
                {inMonth &&
                  (matches.length ? (
                    matches.map((fixture) => {
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
                          key={fixture.id}
                          onClick={() => setSelectedGame(fixture)}
                          aria-label={`Detalhes: ${state.clubs.byId[fixture.homeId]?.name ?? 'Mandante'} contra ${state.clubs.byId[fixture.awayId]?.name ?? 'Visitante'}, ${dateTime(fixture.scheduledAt)}`}
                          title={`${home ? 'Casa' : 'Fora'} · ${opponent?.name ?? 'A definir'} · ${competition?.name} · ${dateTime(fixture.scheduledAt)}`}
                        >
                          <PixelBadge
                            name={opponent?.name ?? 'A definir'}
                            {...(opponent?.crestUrl ? { url: opponent.crestUrl } : {})}
                            size={14}
                          />
                          <strong>
                            {home ? 'Casa' : 'Fora'} <span>{opponent?.abbreviation}</span>
                          </strong>
                          <small>{competition?.name ?? fixture.competitionId}</small>
                          {result && (
                            <b>
                              {result.homeGoals}–{result.awayGoals}
                            </b>
                          )}
                        </button>
                      );
                    })
                  ) : (
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
        <footer className="club-calendar-footer">
          <button className="club-calendar-today" onClick={() => setViewedMonth(null)}>
            Ir para hoje
          </button>
        </footer>
      </section>
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
