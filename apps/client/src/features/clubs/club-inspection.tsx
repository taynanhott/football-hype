import { marketValue } from '../../ui/format';
import { useCollapsedPlayerCategories } from '../../ui/use-collapsed-player-categories';
import { usePlayerPositionFilter } from '../../ui/use-player-position-filter';
import { Fragment } from 'react';
import {
  compareFieldPosition,
  playerCategoryHeading,
  playerPositionCategory,
} from '../players/field-position-order';
import { currency } from '../../ui/format';
import { usePlayerPresentation } from '../../ui/use-player-presentation';
import { PixelBadge } from '../../ui/pixel-badge';
import { PlayerDetails } from '../players/player-details';
import { SquadAverages } from '../players/squad-averages';
import { positionLabel } from '../../ui/position-label';
import { Select, Option } from '../../ui/select';
import { contractEnd, potentialStars } from '@football/domain';
const positions = ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'RM', 'LM', 'AM', 'RW', 'LW', 'SS', 'ST'];
import { STYLE_LABELS } from '@football/domain';
import { useGameStore } from '../../store/game-store';
import { lazy, Suspense, useState, useRef } from 'react';
import { FORMATIONS, clubKit, type ClubSnapshot, type WorldState } from '@football/shared';
import { PlayerCard, Portrait } from '../players/player-card';
const StadiumScene = lazy(() => import('../../three/stadium-scene'));
export function ClubInspection({
  state,
  club,
  view,
}: {
  state: WorldState;
  club: ClubSnapshot;
  view: 'squad' | 'stadium' | 'training';
}) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const selectedPlayer = selectedPlayerId ? state.players.byId[selectedPlayerId] : undefined;
  const [position, setPosition] = usePlayerPositionFilter('club');
  const [collapsedList, toggleListCategory] = useCollapsedPlayerCategories('club');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  function toggleCategory(category: string) {
    setExpandedCategory((previous) => (previous === category ? null : category));
  }
  const historyRef = useRef<HTMLDivElement>(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyCount = Math.min(
    5,
    state.results.filter((r) => r.homeId === club.id || r.awayId === club.id).length,
  );
  function moveHistory(direction: number) {
    const container = historyRef.current;
    const card = container?.querySelector<HTMLElement>('.club-history-match');
    if (container && card)
      container.scrollBy({ left: direction * (card.offsetWidth + 14), behavior: 'smooth' });
  }
  const [presentation, setPresentation] = usePlayerPresentation();
  const userId = useGameStore((s) => s.userId);
  const own = state.participants.some((p) => p.userId === userId && p.clubId === club.id);
  const stadium = state.stadiums.byId[club.stadiumId],
    center = state.centers.byId[club.trainingCenterId];
  if (view === 'squad') {
    const all = club.playerIds
      .flatMap((id) => (state.players.byId[id] ? [state.players.byId[id]!] : []))
      .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));
    const players = all
      .filter((p) => position === 'ALL' || p.position === position)
      .sort(compareFieldPosition);
    return (
      <section className="club-inspection">
        <SquadAverages state={state} club={club} />
        <details className="panel club-match-history">
          <summary>Últimas 5 partidas · esquemas, táticas e escalações</summary>
          {historyCount > 1 && (
            <nav className="club-history-carousel-nav" aria-label="Navegar pelas últimas partidas">
              <button
                type="button"
                aria-label="Partida anterior"
                disabled={historyIndex === 0}
                onClick={() => moveHistory(-1)}
              >
                ‹
              </button>
              <span aria-live="polite">
                {historyIndex + 1} de {historyCount}
              </span>
              <button
                type="button"
                aria-label="Próxima partida"
                disabled={historyIndex >= historyCount - 1}
                onClick={() => moveHistory(1)}
              >
                ›
              </button>
            </nav>
          )}
          <div
            className="club-history-grid"
            ref={historyRef}
            onScroll={(event) => {
              const container = event.currentTarget;
              const card = container.querySelector<HTMLElement>('.club-history-match');
              if (card)
                setHistoryIndex(
                  Math.max(
                    0,
                    Math.min(
                      historyCount - 1,
                      Math.round(container.scrollLeft / (card.offsetWidth + 14)),
                    ),
                  ),
                );
            }}
          >
            {state.results
              .filter((r) => r.homeId === club.id || r.awayId === club.id)
              .slice(-5)
              .reverse()
              .map((r) => {
                const home = r.homeId === club.id;
                const side = home ? 'home' : 'away';
                const plan = r.tacticalPlans?.[side];
                const opponent = state.clubs.byId[(home ? r.awayId : r.homeId) ?? ''];
                const goals = home ? r.homeGoals : r.awayGoals;
                const against = home ? r.awayGoals : r.homeGoals;
                const outcome =
                  goals > against ? 'Vitória' : goals < against ? 'Derrota' : 'Empate';
                const starters = plan?.starters ?? r.lineups?.[side] ?? [];
                return (
                  <article className="club-history-match" key={r.fixtureId}>
                    <header>
                      <span className="club-history-outcome" data-result={outcome}>
                        {outcome}
                      </span>
                      <span>{home ? 'Em casa' : 'Fora de casa'}</span>
                    </header>
                    <div className="club-history-score">
                      <div className="club-history-team">
                        <PixelBadge
                          name={club.name}
                          {...(club.crestUrl ? { url: club.crestUrl } : {})}
                          size={28}
                        />
                        <span>{club.name}</span>
                      </div>
                      <strong>
                        {goals} × {against}
                      </strong>
                      <div className="club-history-team">
                        <PixelBadge
                          name={opponent?.name ?? 'Adversário'}
                          {...(opponent?.crestUrl ? { url: opponent.crestUrl } : {})}
                          size={28}
                        />
                        <span>{opponent?.name ?? 'Adversário indisponível'}</span>
                      </div>
                    </div>
                    <dl className="club-history-plan">
                      <div>
                        <dt>Esquema</dt>
                        <dd>{plan?.formation ?? 'Não registrado'}</dd>
                      </div>
                      <div>
                        <dt>Tática</dt>
                        <dd>{plan ? STYLE_LABELS[plan.style ?? 'balanced'] : 'Não registrada'}</dd>
                      </div>
                    </dl>
                    <h3>
                      Titulares <span>{starters.length}</span>
                    </h3>
                    <ul>
                      {starters.map((id, index) => {
                        const player = state.players.byId[id];
                        const assigned = plan?.formation
                          ? FORMATIONS[plan.formation][index]?.position
                          : player?.position;
                        return (
                          <li key={id}>
                            <span>{positionLabel(assigned)}</span>
                            <strong>{player?.name ?? 'Jogador indisponível'}</strong>
                            <b className="club-history-overall" title="Overall atual">
                              {player?.overall ?? '—'}
                            </b>
                          </li>
                        );
                      })}
                    </ul>
                    {!starters.length && <p>Escalação não registrada.</p>}
                  </article>
                );
              })}
          </div>
          {!state.results.some((r) => r.homeId === club.id || r.awayId === club.id) && (
            <p>Este clube ainda não disputou partidas.</p>
          )}
        </details>
        <div className="squad-office-controls club-inspection-filters">
          <div className="squad-view-field">
            <span id="club-view-label">Visualização</span>
            <div className="segmented" role="group" aria-labelledby="club-view-label">
              <button
                type="button"
                aria-pressed={presentation === 'cards'}
                onClick={() => setPresentation('cards')}
              >
                Cartas
              </button>
              <button
                type="button"
                aria-pressed={presentation === 'list'}
                onClick={() => setPresentation('list')}
              >
                Lista
              </button>
            </div>
          </div>
          <label>
            Posição
            <Select value={position} onValueChange={setPosition}>
              <Option value="ALL">Todas as posições</Option>
              {positions
                .filter((p) => p !== 'SS')
                .map((p) => (
                  <Option key={p} value={p}>
                    {positionLabel(p)}
                  </Option>
                ))}
            </Select>
          </label>
        </div>
        {presentation === 'cards' ? (
          <div className="squad-grid">
            {players.map((player, index) => (
              <Fragment key={player.id}>
                {playerCategoryHeading(players, index) && (
                  <button
                    type="button"
                    className="squad-list-category squad-card-category"
                    aria-expanded={
                      expandedCategory === playerPositionCategory(player.position).title
                    }
                    onClick={() => toggleCategory(playerPositionCategory(player.position).title)}
                  >
                    <span>
                      {expandedCategory === playerPositionCategory(player.position).title
                        ? '▾'
                        : '▸'}{' '}
                      {playerCategoryHeading(players, index)}
                    </span>
                  </button>
                )}
                <div
                  key={player.id}
                  hidden={expandedCategory !== playerPositionCategory(player.position).title}
                >
                  <PlayerCard
                    player={player}
                    clubName={club.name}
                    kit={clubKit(club)}
                    hidePotential={!own}
                    contractExpiring={
                      new Date(contractEnd(state, player)).getUTCFullYear() <= state.season
                    }
                    contractMonths={Math.max(
                      0,
                      Math.ceil(
                        (contractEnd(state, player) - state.lastProcessedAt) / (30 * 86400000),
                      ),
                    )}
                    rivalNegotiationBlocked={Boolean(
                      state.management?.policies?.[player.id]?.available &&
                      !state.management?.policies?.[player.id]?.rivals,
                    )}
                    negotiable={state.management?.policies?.[player.id]?.available ?? false}
                  />
                </div>
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="squad-planning-list">
            {players.map((player, index) => (
              <Fragment key={player.id}>
                {playerCategoryHeading(players, index) && (
                  <button
                    type="button"
                    className="squad-list-category"
                    aria-expanded={
                      !collapsedList.includes(playerPositionCategory(player.position).title)
                    }
                    onClick={() =>
                      toggleListCategory(playerPositionCategory(player.position).title)
                    }
                  >
                    {playerCategoryHeading(players, index)}
                  </button>
                )}
                <button
                  type="button"
                  key={player.id}
                  className="squad-planning-list-row"
                  hidden={collapsedList.includes(playerPositionCategory(player.position).title)}
                  aria-haspopup="dialog"
                  onClick={() => setSelectedPlayerId(player.id)}
                >
                  <strong
                    className="squad-list-overall"
                    data-tier={
                      player.overall >= 86
                        ? 'diamond'
                        : player.overall >= 78
                          ? 'gold'
                          : player.overall >= 70
                            ? 'silver'
                            : 'bronze'
                    }
                  >
                    {player.overall}
                  </strong>
                  <span className="squad-list-portrait">
                    <Portrait player={player} clubName={club.name} kit={clubKit(club)} />
                  </span>
                  <div className="squad-list-player-info">
                    <strong>
                      {player.name} - {positionLabel(player.position)}
                    </strong>
                    <div className="squad-list-player-facts">
                      <div className="squad-list-facts-line">
                        <span>
                          Preço <b>{marketValue(player.marketValue.cents)}</b>
                        </span>
                        <span>
                          Salário <b>{currency(player.salary.cents)}</b> · Contrato{' '}
                          <b
                            className={
                              contractEnd(state, player) - state.lastProcessedAt <= 180 * 86400000
                                ? 'squad-contract-expiring'
                                : undefined
                            }
                          >
                            {Math.max(
                              0,
                              Math.ceil(
                                (contractEnd(state, player) - state.lastProcessedAt) /
                                  (30 * 86400000),
                              ),
                            )}
                            m
                          </b>
                        </span>
                      </div>
                      <div className="squad-list-facts-line">
                        <span>
                          Potencial{' '}
                          <b>
                            {own
                              ? player.potential
                              : '★'.repeat(potentialStars(player.potential)) +
                                '☆'.repeat(5 - potentialStars(player.potential))}
                          </b>
                        </span>
                        <span>
                          À venda{' '}
                          <b>
                            {state.management?.policies?.[player.id]?.available ? 'Sim' : 'Não'}
                          </b>
                        </span>
                        <span>
                          Idade <b>{player.age} anos</b>
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </Fragment>
            ))}
          </div>
        )}
        {!players.length && <p>Nenhum jogador encontrado.</p>}
        {selectedPlayer && (
          <PlayerDetails
            key={selectedPlayer.id}
            player={selectedPlayer}
            club={club}
            onClose={() => setSelectedPlayerId(null)}
          />
        )}
      </section>
    );
  }
  if (!stadium || !center) return <p>Estrutura não disponível para este clube.</p>;
  const labels: Record<string, string> = {
    fitness: 'Preparação física',
    medical: 'Departamento médico',
    scouting: 'Observação',
    coaching: 'Treinamento',
    marketing: 'Marketing',
  };
  return (
    <section className="club-inspection club-facility-inspection">
      <div className="club-facility-scene" key={club.id + view}>
        <Suspense fallback={<p>Carregando estrutura…</p>}>
          <StadiumScene
            stadium={stadium}
            center={center}
            {...(view === 'training' ? { focus: 'training' as const } : {})}
          />
        </Suspense>
      </div>
      <dl className="club-structure-details">
        {view === 'training' ? (
          Object.entries(center.levels).map(([key, level]) => (
            <div key={key}>
              <dt>{labels[key] ?? key}</dt>
              <dd>Nível {level} / 5</dd>
            </div>
          ))
        ) : (
          <>
            <div>
              <dt>Capacidade</dt>
              <dd>
                {stadium.sectors.reduce((s, n) => s + n.capacity, 0).toLocaleString('pt-BR')}{' '}
                lugares
              </dd>
            </div>
            <div>
              <dt>Gramado</dt>
              <dd>Nível {stadium.pitchLevel} / 5</dd>
            </div>
            <div>
              <dt>Entorno</dt>
              <dd>Nível {stadium.surroundingsLevel} / 5</dd>
            </div>
            {[
              ['Estrutura do estádio', Math.max(...stadium.sectors.map((sector) => sector.level))],
              ['Alimentação', stadium.commerce.foodLevel],
              ['Loja do clube', stadium.commerce.shirtsLevel],
              ['Camarotes', stadium.commerce.hospitalityLevel],
            ].map(([label, level]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>Nível {level} / 5</dd>
              </div>
            ))}
          </>
        )}
      </dl>
    </section>
  );
}
