import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { useEffect, useRef } from 'react';
import { clubKit, COMPETITIONS, type Fixture, type WorldState } from '@football/shared';
import {
  matchDemand,
  matchProbabilities,
  pendingFixtures,
  realFixtureTime,
} from '@football/domain';
import { Icon } from '../../ui/icons';
import { PixelBadge } from '../../ui/pixel-badge';
import { currency, dateTime, ticketPrice } from '../../ui/format';

export function GameDetails({
  state,
  fixture,
  clubId,
  onClose,
}: {
  state: WorldState;
  fixture: Fixture;
  clubId: string;
  onClose: () => void;
}) {
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
      className="game-details-modal"
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
        ×
      </button>
      <span className="eyebrow">{result ? 'PARTIDA ENCERRADA' : 'PRÉVIA DA PARTIDA'}</span>
      <h2 id="game-details-title">{competition?.name ?? fixture.competitionId}</h2>
      <p>
        Calendário do jogo: {dateTime(fixture.scheduledAt)}
        <br />
        <Icon name="kickoff" size={16} />{' '}
        {result ? 'Realizado na vida real' : 'Início na vida real'}:{' '}
        {realAt === undefined ? (
          'Aguardando agendamento online'
        ) : (
          <time dateTime={new Date(realAt).toISOString()}>{dateTime(realAt)}</time>
        )}{' '}
        (horário de Brasília)
        <br />
        {fixture.neutral ? 'Campo neutro' : 'Mandante à esquerda'}
      </p>
      <div className="game-details-teams">
        {[home, away].map((team, index) => (
          <div key={index} style={{ borderTopColor: clubKit(team ?? { name: '' }).primary }}>
            <PixelBadge
              name={team?.name ?? 'A definir'}
              {...(team?.crestUrl ? { url: team.crestUrl } : {})}
              size={60}
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
      {isHome &&
        !result &&
        !fixture.neutral &&
        (!fixture.stadiumId || fixture.stadiumId === home?.stadiumId) && (
          <a className="primary full" href="#/finance" onClick={onClose}>
            Definir ingresso em Finanças
          </a>
        )}
    </dialog>
  );
}
