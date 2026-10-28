import {
  clubPayroll,
  maintenanceBreakdown,
  pendingFixtures,
  realFixtureTime,
} from '@football/domain';
import { clubCalendarFixtures } from '../competitions/club-calendar-fixtures';
import { clubKit } from '@football/shared';
import { lazy, Suspense, useState } from 'react';
import type { ViewProps } from '../../ui/view-props';
import { Icon } from '../../ui/icons';
import { PixelBadge } from '../../ui/pixel-badge';
import { compactMoney, dateTime } from '../../ui/format';
import { Portrait } from '../players/pixel-portrait';
import { PlayerDetails } from '../players/player-details';
import { positionLabel } from '../../ui/position-label';
import { CompetitionStatus } from './competition-status';
import { ClubCalendar } from '../competitions/club-calendar';

const StadiumScene = lazy(() => import('../../three/stadium-scene'));
export function Dashboard({ snapshot, club, stadium, center }: ViewProps) {
  const { state } = snapshot;
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const selectedPlayer = selectedPlayerId ? state.players.byId[selectedPlayerId] : undefined;
  const ratings = new Map<string, { sum: number; count: number }>();
  for (const row of state.ratingHistory.filter((row) => row.season === state.season)) {
    const rating = ratings.get(row.playerId) ?? { sum: 0, count: 0 };
    ratings.set(row.playerId, { sum: rating.sum + row.rating, count: rating.count + 1 });
  }
  const players = club.playerIds
    .map((id) => state.players.byId[id])
    .filter((player) => player !== undefined);
  const average = Math.round(
    players.reduce((sum, player) => sum + player.overall, 0) / Math.max(1, players.length),
  );
  const monthlyExpenses =
    clubPayroll(state, club) +
    maintenanceBreakdown(state, club).reduce((sum, item) => sum + item.cost, 0);
  const completed = new Set(state.results.map((result) => result.fixtureId));
  const nextMatch = clubCalendarFixtures(state, club.id)
    .filter((game) => !completed.has(game.id))
    .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  const nextOpponent = nextMatch
    ? state.clubs.byId[nextMatch.homeId === club.id ? nextMatch.awayId : nextMatch.homeId]
    : undefined;
  const latest = state.results
    .filter((result) => result.homeId === club.id || result.awayId === club.id)
    .slice(-8)
    .reverse();
  return (
    <div className="football-dashboard">
      <div className="page-heading dashboard-club-hero">
        <div className="dashboard-club-identity">
          <PixelBadge
            name={club.name}
            {...(club.crestUrl ? { url: club.crestUrl } : {})}
            size={76}
          />
          <div className="dashboard-journey-club">
            <a href={'#/trophies?club=' + club.id}>{club.name}</a>
            <span>
              {new Intl.DisplayNames(['pt-BR'], { type: 'region' }).of(club.country)} · Série{' '}
              {club.division}
            </span>
          </div>
          <div className="dashboard-season-progress">
            <span className="dashboard-journey-label">Sua jornada</span>
            <div className="dashboard-season-label">
              <strong>
                <Icon name="calendar" size={18} />
                Temporada {state.season}
              </strong>
              <span>
                {state.round
                  ? state.round + ' rodadas globais disputadas'
                  : 'Uma história em branco.'}
              </span>
            </div>
            <progress
              aria-label="Progresso da temporada"
              max={100}
              value={Math.min(
                100,
                (state.results.length / Math.max(1, state.fixtures.length + state.cups.length)) *
                  100,
              )}
            />
          </div>
        </div>
      </div>
      <div className="stat-grid dashboard-quick-stats">
        <Metric
          label="Força do elenco"
          value={String(average)}
          note={players.length + ' atletas'}
          icon="squad"
        />
        <Metric
          label="Caixa do clube"
          value={compactMoney(club.balance.cents)}
          note="Saldo disponível"
          icon="finance"
        />
        <Metric
          label="Despesas mensais"
          value={compactMoney(monthlyExpenses)}
          note="Salários + manutenção"
          icon="calendar"
        />
        <Metric
          label="Próximo confronto"
          value={nextOpponent?.name ?? 'A definir'}
          note={
            nextMatch
              ? (() => {
                  const at = realFixtureTime(state, pendingFixtures(state), nextMatch);
                  return at === undefined
                    ? dateTime(nextMatch.scheduledAt)
                    : `${dateTime(at)} · Brasília (vida real)`;
                })()
              : 'Sem partida agendada'
          }
          icon="matches"
        />
      </div>
      <div className="dashboard-middle">
        <section className="arena-card">
          <div className="arena-title">
            <span className="eyebrow light">NOSSA CASA</span>
            <h2>
              <Icon name="stadium" /> {stadium.name}
            </h2>
          </div>
          <div className="arena-canvas">
            <Suspense fallback={<div className="scene-loading">Preparando o gramado…</div>}>
              <StadiumScene stadium={stadium} center={center} />
            </Suspense>
          </div>
          <a className="arena-link" href="#/stadium">
            Conhecer e melhorar a arena <Icon name="arrow" />
          </a>
          <span className="arena-caption">ARRASTE PARA EXPLORAR · ROLE PARA APROXIMAR</span>
        </section>
        <ClubCalendar state={state} clubId={club.id} />
      </div>
      <div className="dashboard-bottom dashboard-season-summary">
        <section className="panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">QUEM FAZ A DIFERENÇA</span>
              <h2>
                <Icon name="squad" /> Destaques do elenco
              </h2>
            </div>
            <a href="#/squad">Ver elenco ↗</a>
          </div>
          <div className="dashboard-featured-list">
            {[...players]
              .filter((player) => ratings.has(player.id))
              .sort((a, b) => {
                const ra = ratings.get(a.id)!;
                const rb = ratings.get(b.id)!;
                return rb.sum / rb.count - ra.sum / ra.count || rb.count - ra.count;
              })
              .slice(0, 3)
              .map((player, index) => {
                const rating = ratings.get(player.id)!;
                return (
                  <button
                    className="dashboard-featured-row"
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                  >
                    <span className="dashboard-featured-rank">{index + 1}</span>
                    <Portrait player={player} clubName={club.name} kit={clubKit(club)} />
                    <span className="dashboard-featured-name">
                      <strong>{player.name}</strong>
                      <small>
                        {positionLabel(player.position)} · {rating.count} jogos
                      </small>
                    </span>
                    <span className="dashboard-featured-rating">
                      <small>Média</small>
                      <b>{(rating.sum / rating.count).toFixed(2)}</b>
                    </span>
                  </button>
                );
              })}
            {!players.some((player) => ratings.has(player.id)) && (
              <p className="dashboard-compact-empty">
                Os destaques por média aparecerão após as primeiras partidas.
              </p>
            )}
          </div>
        </section>
        <CompetitionStatus snapshot={snapshot} club={club} stadium={stadium} center={center} />
        <section className="panel">
          <div className="section-header">
            <div>
              <span className="eyebrow">A BOLA ROLOU</span>
              <h2>
                <Icon name="ball" /> Últimos resultados
              </h2>
            </div>
            <a href="#/calendar">Todos ↗</a>
          </div>
          {latest.length ? (
            latest.slice(0, 5).map((result) => {
              const fixture =
                state.fixtures.find((item) => item.id === result.fixtureId) ??
                state.cups.find((item) => item.id === result.fixtureId);
              return (
                <div className="result-row" key={result.fixtureId}>
                  <span>{state.clubs.byId[fixture?.homeId ?? '']?.abbreviation ?? 'Casa'}</span>
                  <strong>
                    {result.homeGoals}
                    <span>:</span>
                    {result.awayGoals}
                  </strong>
                  <span>{state.clubs.byId[fixture?.awayId ?? '']?.abbreviation ?? 'Fora'}</span>
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <Icon name="ball" size={36} />
              <h3>A história ainda vai começar.</h3>
              <p>Prepare seu time e avance para a primeira rodada.</p>
            </div>
          )}
        </section>
      </div>
      {selectedPlayer && (
        <PlayerDetails
          player={selectedPlayer}
          club={club}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
}) {
  return (
    <section className="metric">
      <div>
        <span>{label}</span>
        <Icon name={icon} />
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </section>
  );
}
