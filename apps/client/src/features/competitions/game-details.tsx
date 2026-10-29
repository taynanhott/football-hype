import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { useEffect, useRef, useState } from 'react';
import { clubCalendarFixtures } from './club-calendar-fixtures';
import { clubKit, COMPETITIONS, type Fixture, type WorldState } from '@football/shared';
import {
  matchDemand,
  matchProbabilities,
  pendingFixtures,
  realFixtureTime,
} from '@football/domain';
import { Icon } from '../../ui/icons';
import { PixelBadge } from '../../ui/pixel-badge';
import { currency, ticketPrice } from '../../ui/format';

function MatchDate({ at, label }: { at: number; label: string }) {
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'America/Sao_Paulo' })
      .format(at)
      .replace(/\./g, '');
  return (
    <time className="match-date-stamp" dateTime={new Date(at).toISOString()} aria-label={label}>
      <strong>{format({ day: '2-digit' })}</strong>
      <span>
        <b>
          {format({ month: 'short' })} <em>{format({ weekday: 'short' })}</em>
        </b>
        <small>{format({ year: 'numeric' })}</small>
      </span>
    </time>
  );
}
function calendarDay(at: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day'));
}
export function GameDetails({
  state,
  fixture: initialFixture,
  clubId,
  onClose,
}: {
  state: WorldState;
  fixture: Fixture;
  clubId: string;
  onClose: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [viewedId, setViewedId] = useState(initialFixture.id);
  const fixtures = clubCalendarFixtures(state, clubId).sort(
    (a, b) => a.scheduledAt - b.scheduledAt || a.id.localeCompare(b.id),
  );
  const fixture = fixtures.find((item) => item.id === viewedId) ?? initialFixture;
  const fixtureIndex = fixtures.findIndex((item) => item.id === fixture.id);
  const previousFixture = fixtures[fixtureIndex - 1];
  const nextFixture = fixtureIndex < 0 ? undefined : fixtures[fixtureIndex + 1];
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    return openModalPreservingScroll(dialog.current);
  }, []);
  const home = state.clubs.byId[fixture.homeId],
    away = state.clubs.byId[fixture.awayId];
  const stadium = state.stadiums.byId[fixture.stadiumId ?? home?.stadiumId ?? ''];
  const result = state.results.find((item) => item.fixtureId === fixture.id);
  const realAt = result?.startedAt ?? realFixtureTime(state, pendingFixtures(state), fixture);
  const demand = matchDemand(state, fixture);
  const odds = result ? undefined : matchProbabilities(state, fixture);
  const isHome = fixture.homeId === clubId;
  const win = odds ? (isHome ? odds.home : odds.away) : 0;
  const loss = odds ? (isHome ? odds.away : odds.home) : 0;
  const competition = COMPETITIONS.find((item) => item.id === fixture.competitionId);
  return (
    <dialog
      ref={dialog}
      className="game-details-modal compact-match-preview"
      aria-labelledby="game-details-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== dialog.current) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <button className="close-modal" onClick={onClose} aria-label="Fechar detalhes do jogo">
        <svg
          width="16"
          height="16"
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
      <nav className="game-details-navigation" aria-label="Jogos do seu clube">
        <button
          type="button"
          aria-label="Jogo anterior"
          title="Jogo anterior"
          disabled={!previousFixture}
          onClick={() => previousFixture && setViewedId(previousFixture.id)}
        >
          ‹
        </button>
        <span aria-live="polite">
          {fixtureIndex >= 0 ? `${fixtureIndex + 1} de ${fixtures.length}` : 'Jogo selecionado'}
        </span>
        <button
          type="button"
          aria-label="Próximo jogo"
          title="Próximo jogo"
          disabled={!nextFixture}
          onClick={() => nextFixture && setViewedId(nextFixture.id)}
        >
          ›
        </button>
      </nav>
      <header className="match-programme-header">
        <MatchDate at={fixture.scheduledAt} label="Data da temporada" />
        <div className="match-kickoff-clock">
          {realAt === undefined ? (
            <strong className="match-unscheduled">A agendar</strong>
          ) : (
            <>
              {calendarDay(realAt) === calendarDay(now) ? (
                <span className="match-relative-day">Hoje</span>
              ) : calendarDay(realAt) === calendarDay(now) + 86400000 ? (
                <span className="match-relative-day">Amanhã</span>
              ) : (
                <MatchDate at={realAt} label="Data da partida em Brasília" />
              )}
              <time className="match-start-time" dateTime={new Date(realAt).toISOString()}>
                {new Intl.DateTimeFormat('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                }).format(realAt)}
              </time>
            </>
          )}
        </div>
      </header>
      <h2 id="game-details-title" className="match-competition-badge">
        <Icon name="trophy" size={14} /> {competition?.name ?? fixture.competitionId} · Rodada{' '}
        {fixture.round}
      </h2>
      <div className="game-details-teams">
        {[home, away].map((team, index) => (
          <div key={index} style={{ borderTopColor: clubKit(team ?? { name: '' }).primary }}>
            <PixelBadge
              name={team?.name ?? 'A definir'}
              {...(team?.crestUrl ? { url: team.crestUrl } : {})}
              size={48}
            />
            {team ? (
              <a
                className="game-details-club-link"
                href={'#/trophies?club=' + team.id}
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey)
                    onClose();
                }}
                aria-label={'Ver dados do ' + team.name}
              >
                <strong>{team.name}</strong>
                <Icon name="arrow" size={14} />
              </a>
            ) : (
              <strong>A definir</strong>
            )}
            <small>{index === 0 ? 'Mandante' : 'Visitante'}</small>
          </div>
        ))}
        <strong className="game-details-score">
          {result ? `${result.homeGoals}–${result.awayGoals}` : '×'}
        </strong>
      </div>
      {result?.penalties && (
        <p className="game-details-penalties">
          Pênaltis: {result.penalties.home}–{result.penalties.away}
        </p>
      )}
      {odds && (
        <section className="game-details-probabilities">
          <h3>Chances do {state.clubs.byId[clubId]?.name ?? 'seu clube'}</h3>
          <div
            className="game-probability-bar"
            role="img"
            aria-label={`Vitória ${win}%, empate ${odds.draw}%, derrota ${loss}%`}
          >
            <span className="probability-win" style={{ width: `${win}%` }} />
            <span className="probability-draw" style={{ width: `${odds.draw}%` }} />
            <span className="probability-loss" style={{ width: `${loss}%` }} />
          </div>
          <div className="game-probability-labels">
            <span>
              <Icon name="arrow" size={17} /> Vitória <b>{win}%</b>
            </span>
            <span>
              <Icon name="tactics" size={17} /> Empate <b>{odds.draw}%</b>
            </span>
            <span>
              <Icon name="ball" size={17} /> Derrota <b>{loss}%</b>
            </span>
          </div>
        </section>
      )}
      <dl className="game-details-facts">
        <div>
          <dt>
            <Icon name="stadium" /> Estádio
          </dt>
          <dd>{stadium?.name ?? 'A definir'}</dd>
        </div>
        <div>
          <dt>
            <Icon name="squad" /> Capacidade
          </dt>
          <dd>{demand.capacity.toLocaleString('pt-BR')} lugares</dd>
        </div>
        <div>
          <dt>
            <Icon name="megaphone" />
            {result ? 'Público presente' : 'Público esperado'}
          </dt>
          <dd>{(result?.attendance ?? demand.attendance).toLocaleString('pt-BR')} torcedores</dd>
        </div>
        <div>
          <dt>
            <Icon name="finance" />
            {result ? 'Ingresso aplicado' : 'Ingresso'}
          </dt>
          <dd>
            {result
              ? result.ticketPriceCents
                ? ticketPrice(result.ticketPriceCents)
                : 'Não registrado'
              : ticketPrice(demand.priceCents)}
          </dd>
        </div>
        <div>
          <dt>
            <Icon name="market" />
            {result ? 'Receita do jogo' : 'Receita prevista'}
          </dt>
          <dd>{currency(result?.revenue ?? demand.revenue)}</dd>
        </div>
        <div>
          <dt>
            <Icon name="ball" /> Confronto
          </dt>
          <dd>{demand.importanceLabel}</dd>
        </div>
      </dl>
    </dialog>
  );
}
