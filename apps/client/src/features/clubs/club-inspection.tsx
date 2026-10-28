import { PlayerDetails } from '../players/player-details';
import { SquadAverages } from '../players/squad-averages';
import { positionLabel } from '../../ui/position-label';
import { currency } from '../../ui/format';
import { Select, Option } from '../../ui/select';
import { contractEnd, potentialStars } from '@football/domain';
const columns = [
  'Jogador',
  'Posição',
  'Idade',
  'Overall',
  'Potencial',
  'Condição',
  'Salário mensal',
  'Contrato',
  'Disponível para negociação',
];
const positions = ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'RM', 'LM', 'AM', 'RW', 'LW', 'SS', 'ST'];
import { STYLE_LABELS } from '@football/domain';
import { useGameStore } from '../../store/game-store';
import { lazy, Suspense, useState } from 'react';
import { FORMATIONS, clubKit, type ClubSnapshot, type WorldState } from '@football/shared';
import { PlayerCard } from '../players/player-card';
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
  const [position, setPosition] = useState('ALL');
  const [presentation, setPresentation] = useState('cards');
  const [sort, setSort] = useState({ column: 3, ascending: false });
  const [hover, setHover] = useState<number | null>(null);
  function toggleSort(column: number) {
    setSort((old) => ({ column, ascending: old.column === column ? !old.ascending : true }));
  }

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
      .sort((a, b) => {
        const value = (p: typeof a): string | number => {
          switch (sort.column) {
            case 0:
              return p.name;
            case 1:
              return positions.indexOf(p.position);
            case 2:
              return p.age;
            case 3:
              return p.overall;
            case 4:
              return own ? p.potential : potentialStars(p.potential);
            case 5:
              return p.fitness;
            case 6:
              return p.salary.cents;
            case 7:
              return contractEnd(state, p);
            default:
              return Number(state.management?.policies?.[p.id]?.available ?? false);
          }
        };
        const av = value(a),
          bv = value(b);
        const diff =
          typeof av === 'string' && typeof bv === 'string'
            ? av.localeCompare(bv, 'pt-BR')
            : Number(av) - Number(bv);
        return (sort.ascending ? diff : -diff) || a.name.localeCompare(b.name, 'pt-BR');
      });
    return (
      <section className="club-inspection">
        <div className="squad-controls-row">
          <div className="toolbar squad-filters">
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
            <label>
              Apresentação
              <Select value={presentation} onValueChange={setPresentation}>
                <Option value="cards">Cartas</Option>
                <Option value="list">Lista</Option>
              </Select>
            </label>
          </div>
          <SquadAverages state={state} club={club} />
        </div>
        <details className="panel club-match-history">
          <summary>Últimas 5 partidas · esquemas, táticas e escalações</summary>
          <div className="club-history-grid">
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
                      <strong>
                        {goals} × {against}
                      </strong>
                      <span>vs. {opponent?.name ?? 'Adversário indisponível'}</span>
                    </div>
                    <dl className="club-history-plan">
                      <div>
                        <dt>Esquema</dt>
                        <dd>{plan?.formation ?? 'Não registrado'}</dd>
                      </div>
                      <div>
                        <dt>Tática</dt>
                        <dd>{plan?.style ? STYLE_LABELS[plan.style] : 'Não registrada'}</dd>
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
        {presentation === 'cards' ? (
          <div className="squad-grid">
            {players.map((player) => (
              <div key={player.id}>
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
            ))}
          </div>
        ) : (
          <div className="squad-table-scroll">
            <table
              className="squad-table"
              data-hovered-column={hover ?? undefined}
              onMouseLeave={() => setHover(null)}
              onMouseOver={(event) => {
                const cell = (event.target as HTMLElement).closest(
                  'td,th',
                ) as HTMLTableCellElement | null;
                setHover(cell?.cellIndex ?? null);
              }}
              onClick={(event) => {
                const cell = (event.target as HTMLElement).closest(
                  'td,th',
                ) as HTMLTableCellElement | null;
                if (cell && !(event.target as HTMLElement).closest('button'))
                  toggleSort(cell.cellIndex);
              }}
            >
              <thead>
                <tr>
                  {columns.map((label, i) => (
                    <th
                      key={label}
                      scope="col"
                      aria-sort={
                        sort.column === i ? (sort.ascending ? 'ascending' : 'descending') : 'none'
                      }
                    >
                      <button className="squad-sort" onClick={() => toggleSort(i)}>
                        {label} {sort.column === i ? (sort.ascending ? '↑' : '↓') : '↕'}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        type="button"
                        className="squad-list-name"
                        onClick={() => setSelectedPlayerId(p.id)}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td>{positionLabel(p.position)}</td>
                    <td>{p.age}</td>
                    <td>{p.overall}</td>
                    <td>
                      {own ? (
                        p.potential
                      ) : (
                        <span className="squad-potential">
                          {'★'.repeat(potentialStars(p.potential))}
                          {'☆'.repeat(5 - potentialStars(p.potential))}
                        </span>
                      )}
                    </td>
                    <td>{p.fitness}%</td>
                    <td>{currency(p.salary.cents)}</td>
                    <td>
                      <span
                        className={
                          new Date(contractEnd(state, p)).getUTCFullYear() <= state.season
                            ? 'contract-months is-urgent'
                            : 'contract-months'
                        }
                        title="Meses restantes de contrato"
                      >
                        {Math.max(
                          0,
                          Math.ceil(
                            (contractEnd(state, p) - state.lastProcessedAt) / (30 * 86400000),
                          ),
                        )}
                        m
                      </span>
                    </td>
                    <td>{state.management?.policies?.[p.id]?.available ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    <section className="club-inspection">
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
