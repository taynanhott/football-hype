import { SquadAverages } from './squad-averages';
import { Overall } from './overall';
import { positionLabel } from '../../ui/position-label';
import { Select, Option } from '../../ui/select';
import { PlayerManagement } from './player-management';
import { contractEnd, effectiveOverall } from '@football/domain';
import { clubKit } from '@football/shared';
import { useState } from 'react';
import type { ViewProps } from '../../ui/view-props';
import { PlayerCard } from './player-card';
import { PlayerModal } from './player-modal';
import { currency } from '../../ui/format';

const squadColumns = [
  ['name', 'Jogador'],
  ['position', 'Posição'],
  ['age', 'Idade'],
  ['overall', 'Overall'],
  ['potential', 'Potencial'],
  ['fitness', 'Condição'],
  ['salary', 'Salário mensal'],
  ['contract', 'Contrato'],
  ['available', 'Disponível para negociação'],
] as const;
const positionOrder = [
  'GOL',
  'ZAG',
  'LD',
  'LE',
  'VOL',
  'MC',
  'MD',
  'ME',
  'MEI',
  'PD',
  'PE',
  'SA',
  'CA',
];
type SortColumn = (typeof squadColumns)[number][0];

export function Squad(props: ViewProps) {
  const { snapshot, club } = props;
  const [position, setPosition] = useState('ALL');
  const [presentation, setPresentation] = useState('cards');
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);
  const [sort, setSort] = useState<{ column: SortColumn; ascending: boolean }>({
    column: 'name',
    ascending: true,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const players = club.playerIds
    .flatMap((id) => (snapshot.state.players.byId[id] ? [snapshot.state.players.byId[id]!] : []))
    .filter((p) => position === 'ALL' || p.position === position);
  const sortedPlayers = [...players].sort((a, b) => {
    let comparison = 0;
    switch (sort.column) {
      case 'name':
        comparison = a.name.localeCompare(b.name, 'pt-BR');
        break;
      case 'position':
        comparison =
          positionOrder.indexOf(positionLabel(a.position)) -
          positionOrder.indexOf(positionLabel(b.position));
        break;
      case 'age':
        comparison = a.age - b.age;
        break;
      case 'overall':
        comparison = a.overall - b.overall;
        break;
      case 'potential':
        comparison = a.potential - b.potential;
        break;
      case 'fitness':
        comparison = a.fitness - b.fitness;
        break;
      case 'contract':
        comparison = contractEnd(snapshot.state, a) - contractEnd(snapshot.state, b);
        break;
      case 'salary':
        comparison = a.salary.cents - b.salary.cents;
        break;
      case 'available':
        comparison =
          Number(snapshot.state.management?.policies?.[a.id]?.available ?? false) -
          Number(snapshot.state.management?.policies?.[b.id]?.available ?? false);
        break;
    }
    return (sort.ascending ? comparison : -comparison) || a.name.localeCompare(b.name, 'pt-BR');
  });
  function toggleSort(column: SortColumn) {
    setSort((previous) => ({
      column,
      ascending: previous.column === column ? !previous.ascending : true,
    }));
  }
  const candidate = selectedId ? snapshot.state.players.byId[selectedId] : undefined;
  const selected = candidate?.clubId === club.id ? candidate : undefined;
  const history = snapshot.state.ratingHistory.filter((r) => r.playerId === selectedId);
  return (
    <>
      <div className="squad-controls-row">
        <div className="toolbar squad-filters">
          <label>
            Posição
            <Select value={position} onValueChange={(value) => setPosition(value)}>
              {['ALL', 'GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST', 'LM', 'RM'].map(
                (value) => (
                  <Option key={value} value={value}>
                    {value === 'ALL' ? 'Todas as posições' : positionLabel(value)}
                  </Option>
                ),
              )}
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
        <SquadAverages state={snapshot.state} club={club} />
      </div>
      {presentation === 'cards' ? (
        <div className="squad-grid">
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              contractExpiring={
                new Date(contractEnd(snapshot.state, player)).getUTCFullYear() <=
                snapshot.state.season
              }
              contractMonths={Math.max(
                0,
                Math.ceil(
                  (contractEnd(snapshot.state, player) - snapshot.state.lastProcessedAt) /
                    (30 * 86400000),
                ),
              )}
              rivalNegotiationBlocked={Boolean(
                snapshot.state.management?.policies?.[player.id]?.available &&
                !snapshot.state.management?.policies?.[player.id]?.rivals,
              )}
              negotiable={snapshot.state.management?.policies?.[player.id]?.available ?? false}
              modifier={effectiveOverall(snapshot.state, player) - player.overall}
              clubName={club.name}
              kit={clubKit(club)}
              onActivate={() => setSelectedId(player.id)}
            />
          ))}
        </div>
      ) : (
        <div className="squad-table-scroll">
          <table
            className="squad-table"
            data-hovered-column={hoveredColumn ?? undefined}
            onMouseLeave={() => setHoveredColumn(null)}
            onMouseOver={(event) => {
              const cell = (event.target as HTMLElement).closest(
                'td, th',
              ) as HTMLTableCellElement | null;
              setHoveredColumn(cell?.cellIndex ?? null);
            }}
            onClick={(event) => {
              if ((event.target as HTMLElement).closest('button')) return;
              const cell = (event.target as HTMLElement).closest(
                'td, th',
              ) as HTMLTableCellElement | null;
              const column = cell ? squadColumns[cell.cellIndex]?.[0] : undefined;
              if (column) toggleSort(column);
            }}
          >
            <thead>
              <tr>
                {squadColumns.map(([column, label]) => (
                  <th
                    key={column}
                    scope="col"
                    aria-sort={
                      sort.column === column
                        ? sort.ascending
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="squad-sort"
                      onClick={() =>
                        setSort((previous) => ({
                          column,
                          ascending: previous.column === column ? !previous.ascending : true,
                        }))
                      }
                    >
                      {label}{' '}
                      <span aria-hidden="true">
                        {sort.column === column ? (sort.ascending ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr key={player.id}>
                  <td>
                    <button className="squad-list-name" onClick={() => setSelectedId(player.id)}>
                      {player.name}
                    </button>
                  </td>
                  <td>{positionLabel(player.position)}</td>
                  <td>{player.age}</td>
                  <td>
                    <Overall
                      base={player.overall}
                      modifier={effectiveOverall(snapshot.state, player) - player.overall}
                    />
                  </td>
                  <td>{player.potential}</td>
                  <td>{player.fitness}%</td>
                  <td>{currency(player.salary.cents)}</td>
                  <td>
                    <span
                      className={
                        new Date(contractEnd(snapshot.state, player)).getUTCFullYear() <=
                        snapshot.state.season
                          ? 'contract-months is-urgent'
                          : 'contract-months'
                      }
                    >
                      {Math.max(
                        0,
                        Math.ceil(
                          (contractEnd(snapshot.state, player) - snapshot.state.lastProcessedAt) /
                            (30 * 86400000),
                        ),
                      )}
                      m
                    </span>
                  </td>
                  <td>
                    <span
                      className={
                        snapshot.state.management?.policies?.[player.id]?.available
                          ? 'squad-negotiable'
                          : 'squad-unavailable'
                      }
                    >
                      {snapshot.state.management?.policies?.[player.id]?.available ? 'Sim' : 'Não'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!players.length && <p>Nenhum jogador nesta posição.</p>}
        </div>
      )}
      {selected && (
        <PlayerModal
          className="squad-detail-modal"
          title={selected.name}
          onClose={() => setSelectedId(null)}
        >
          <div className="squad-detail-grid">
            <section className="squad-detail-profile">
              <div className="player-detail-card">
                <PlayerCard
                  player={selected}
                  modifier={effectiveOverall(snapshot.state, selected) - selected.overall}
                  clubName={club.name}
                  kit={clubKit(club)}
                />
              </div>
              <p>
                Última nota: {history.at(-1)?.rating.toFixed(1) ?? '—'} · Média:{' '}
                {history.length
                  ? (history.reduce((sum, r) => sum + r.rating, 0) / history.length).toFixed(1)
                  : '—'}
              </p>
              {snapshot.state.injuries[selected.id] && (
                <p className="negative">Lesionado: {snapshot.state.injuries[selected.id]} dias</p>
              )}
              <dl className="player-overview">
                {[['Salário mensal', currency(selected.salary.cents)]].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="squad-detail-controls">
              <PlayerManagement key={selected.id} player={selected} snapshot={snapshot} />
              <a
                className="squad-player-offers squad-offers-link"
                href="#/market?tab=proposals"
                onClick={() => setSelectedId(null)}
              >
                Propostas recebidas <span aria-hidden="true">↗</span>
              </a>
            </section>
          </div>
        </PlayerModal>
      )}
    </>
  );
}
