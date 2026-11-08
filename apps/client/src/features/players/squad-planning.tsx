import { Icon } from '../../ui/icons';
import { CountryFlag } from '../../ui/country-flag';
import { shortMoney } from '../../ui/format';
import { PixelBadge } from '../../ui/pixel-badge';
import { useCollapsedPlayerCategories } from '../../ui/use-collapsed-player-categories';
import {
  compareFieldPosition,
  playerCategoryHeading,
  playerPositionCategory,
} from './field-position-order';
import { useState, useSyncExternalStore } from 'react';
import { clubKit } from '@football/shared';
import { renewalTerms, contractEnd, masteredPositions } from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';

import { positionLabel } from '../../ui/position-label';
import { PlayerCard, Portrait } from './player-card';
import { PlayerManagement } from './player-management';

import { PlayerModal } from './player-modal';
import { Select, Option } from '../../ui/select';

const mobileQuery = '(max-width: 760px)';
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const subscribeMobile = (change: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};
const mobileActions = [
  { id: 'policy', label: 'Transferências' },
  { id: 'effects', label: 'Efeitos' },
  { id: 'renew', label: 'Contrato' },
] as const;

export function SquadPlanning({ snapshot, club }: ViewProps) {
  const [position, setPosition] = useState('ALL');
  const [order, setOrder] = useState('position');
  const [rosterTab, setRosterTab] = useState('players');
  const [collapsedList, toggleListCategory] = useCollapsedPlayerCategories('squad');
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  function playerAlert(player: (typeof players)[number]) {
    return (
      snapshot.state.management?.offers?.some(
        (offer) =>
          offer.playerId === player.id && offer.sellerId === club.id && offer.status === 'pending',
      ) ||
      renewalTerms(snapshot.state, player).demand ||
      contractEnd(snapshot.state, player) - snapshot.state.lastProcessedAt <= 180 * 86400000
    );
  }
  function categoryAlert(position: string) {
    return players.some(
      (player) =>
        playerPositionCategory(player.position).title === playerPositionCategory(position).title &&
        playerAlert(player),
    );
  }
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const [mobileAction, setMobileAction] = useState<{
    playerId: string;
    section: 'effects' | 'policy' | 'renew';
  } | null>(null);
  const locked = useGameStore((s) => s.busy);
  const preview = snapshot;
  const players = club.playerIds
    .flatMap((id) => (snapshot.state.players.byId[id] ? [snapshot.state.players.byId[id]!] : []))
    .filter(
      (p) =>
        position === 'ALL' ||
        (position === 'GK'
          ? p.position === 'GK'
          : position === 'DEF'
            ? ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)
            : position === 'MEI'
              ? ['DM', 'CM', 'AM', 'LM', 'RM'].includes(p.position)
              : ['LW', 'RW', 'SS', 'ST'].includes(p.position)),
    );
  players.sort((a, b) => {
    const difference =
      order === 'overall'
        ? b.overall - a.overall
        : order === 'fitness'
          ? b.fitness - a.fitness
          : order === 'morale'
            ? b.morale - a.morale
            : order === 'age'
              ? a.age - b.age
              : order === 'salary'
                ? b.salary.cents - a.salary.cents
                : order === 'contract'
                  ? contractEnd(snapshot.state, a) - contractEnd(snapshot.state, b)
                  : 0;
    return difference || compareFieldPosition(a, b);
  });
  const groups =
    order !== 'position'
      ? players.length
        ? [players]
        : []
      : [...new Set(players.map((player) => playerPositionCategory(player.position).title))].map(
          (title) =>
            players.filter((player) => playerPositionCategory(player.position).title === title),
        );
  return (
    <div className="squad-office">
      <section className="squad-office-roster" aria-label="Jogadores do elenco">
        <div className="squad-office-controls">
          <div className="squad-roster-tabs" role="group" aria-label="Visão do elenco">
            <button
              type="button"
              className={rosterTab === 'players' ? 'selected' : ''}
              aria-pressed={rosterTab === 'players'}
              onClick={() => setRosterTab('players')}
            >
              <Icon name="shirt" size={16} /> Jogadores
            </button>
            <button
              type="button"
              className={rosterTab === 'numbers' ? 'selected' : ''}
              aria-pressed={rosterTab === 'numbers'}
              onClick={() => setRosterTab('numbers')}
            >
              <Icon name="tactics" size={16} /> Estatísticas
            </button>
          </div>
          <div className="squad-sector-filters" role="group" aria-label="Setor do jogador">
            {[
              ['ALL', 'Todos'],
              ['GK', 'GOL'],
              ['DEF', 'DEF'],
              ['MEI', 'MEI'],
              ['ATA', 'ATA'],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={position === value}
                className={position === value ? 'selected' : ''}
                onClick={() => setPosition(value!)}
              >
                {label}
              </button>
            ))}
          </div>
          <Select
            value={order}
            onValueChange={setOrder}
            menuMinWidth={180}
            aria-label="Ordenar elenco"
          >
            {[
              ['position', 'Posição'],
              ['overall', 'Overall'],
              ['fitness', 'Condição'],
              ['morale', 'Moral'],
              ['age', 'Idade'],
              ['salary', 'Salário'],
              ['contract', 'Contrato'],
            ].map(([value, label]) => (
              <Option key={value} value={value!}>
                {label}
              </Option>
            ))}
          </Select>
        </div>
        {rosterTab === 'numbers' ? (
          <div className="squad-numbers-wrap">
            <table className="squad-numbers">
              <thead>
                <tr>
                  <th>Jogador</th>
                  <th title="Jogos">J</th>
                  <th title="Gols">G</th>
                  <th title="Assistências">A</th>
                  <th title="Cartões amarelos">🟨</th>
                  <th title="Cartões vermelhos">🟥</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => {
                  const history = snapshot.state.ratingHistory.filter(
                    (row) => row.playerId === player.id && row.season === snapshot.state.season,
                  );
                  let goals = 0,
                    assists = 0,
                    yellow = 0,
                    red = 0;
                  for (const result of snapshot.state.results) {
                    goals += result.scorers.filter((goal) => goal.playerId === player.id).length;
                    assists += result.scorers.filter((goal) => goal.assistId === player.id).length;
                    yellow += (result.actions ?? []).filter(
                      (action) => action.playerId === player.id && action.type === 'yellow',
                    ).length;
                    red += (result.actions ?? []).filter(
                      (action) => action.playerId === player.id && action.type === 'red',
                    ).length;
                  }
                  const average = history.length
                    ? history.reduce((sum, row) => sum + row.rating, 0) / history.length
                    : null;
                  return (
                    <tr key={player.id} onClick={() => setSelectedPlayerId(player.id)}>
                      <td>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedPlayerId(player.id);
                          }}
                        >
                          <Portrait player={player} clubName={club.name} kit={clubKit(club)} />
                          <span className="squad-statistics-identity">
                            <strong>
                              {player.name}
                              {renewalTerms(snapshot.state, player).demand && (
                                <span
                                  className="squad-notification-dot"
                                  aria-label="Jogador pede renovação"
                                />
                              )}
                            </strong>
                            <small>{positionLabel(player.position)}</small>
                          </span>
                        </button>
                      </td>
                      <td>{history.length}</td>
                      <td>{goals}</td>
                      <td>{assists}</td>
                      <td>{yellow}</td>
                      <td>{red}</td>
                      <td>
                        <span
                          className={
                            'squad-rating ' + (average !== null && average >= 7 ? 'is-high' : '')
                          }
                        >
                          {average === null ? '—' : average.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="squad-planning-list">
            {groups.map((group) => {
              const player = group[0]!;
              const index = players.indexOf(player);
              return (
                <section
                  className="squad-category-group"
                  key={playerPositionCategory(player.position).title}
                >
                  {order === 'position' && playerCategoryHeading(players, index) && (
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
                      <span>{playerCategoryHeading(players, index)}</span>
                      {categoryAlert(player.position) && (
                        <span
                          className="squad-notification-dot"
                          aria-label="Jogador com pendência"
                        />
                      )}
                    </button>
                  )}
                  <div
                    className="squad-category-players"
                    hidden={
                      order === 'position' &&
                      collapsedList.includes(playerPositionCategory(player.position).title)
                    }
                  >
                    {group.map((player) => (
                      <button
                        type="button"
                        key={player.id}
                        className="squad-planning-list-row"
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
                          <div className="squad-player-identity">
                            <strong>
                              {player.name}
                              <span className="squad-player-country">
                                <CountryFlag country={player.nationality} />
                              </span>
                              {mobile && (
                                <span className="squad-player-positions">
                                  {masteredPositions(snapshot.state, player)
                                    .map(positionLabel)
                                    .join(' / ')}
                                </span>
                              )}
                              {playerAlert(player) && (
                                <span
                                  className="squad-notification-dot squad-player-alert"
                                  role="img"
                                  aria-label="Jogador com proposta, pedido de renegociação ou contrato no fim"
                                />
                              )}
                            </strong>
                            {!mobile && (
                              <span className="squad-player-positions">
                                {masteredPositions(snapshot.state, player)
                                  .map(positionLabel)
                                  .join(' / ')}
                              </span>
                            )}
                          </div>
                          <div className="squad-list-player-facts">
                            <div className="squad-list-facts-line">
                              <span>
                                Preço <b>{shortMoney(player.marketValue.cents)}</b>
                              </span>
                              <span>
                                Salário <b>{shortMoney(player.salary.cents)}</b>
                              </span>
                              <span>
                                Contrato{' '}
                                <b
                                  className={
                                    contractEnd(preview.state, player) -
                                      preview.state.lastProcessedAt <=
                                    180 * 86400000
                                      ? 'squad-contract-expiring'
                                      : undefined
                                  }
                                >
                                  {Math.max(
                                    0,
                                    Math.ceil(
                                      (contractEnd(preview.state, player) -
                                        preview.state.lastProcessedAt) /
                                        (30 * 86400000),
                                    ),
                                  )}
                                  m
                                </b>
                              </span>
                            </div>
                            <div className="squad-list-facts-line">
                              <span>
                                Idade <b>{player.age} anos</b>
                              </span>
                              <span>
                                À venda{' '}
                                <b>
                                  {preview.state.management?.policies?.[player.id]?.available
                                    ? 'Sim'
                                    : 'Não'}
                                </b>
                              </span>
                              <span className="squad-desktop-loan">
                                Empréstimo{' '}
                                <b>
                                  {preview.state.management?.policies?.[player.id]?.loanAvailable
                                    ? 'Sim'
                                    : 'Não'}
                                </b>
                              </span>
                              <span>
                                Potencial <b>{player.potential}</b>
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {!players.length && (
          <p className="squad-office-empty">Nenhum jogador encontrado com esses filtros.</p>
        )}
      </section>
      {selectedPlayerId && preview.state.players.byId[selectedPlayerId]?.clubId === club.id && (
        <PlayerModal
          className="squad-action-modal squad-roster-management-modal"
          titleIcon={
            <PixelBadge
              name={club.name}
              {...(club.crestUrl ? { url: club.crestUrl } : {})}
              size={32}
            />
          }
          title={preview.state.players.byId[selectedPlayerId]!.name}
          onClose={() => setSelectedPlayerId(null)}
        >
          <div className="squad-modal-player-card">
            <PlayerCard
              player={preview.state.players.byId[selectedPlayerId]!}
              clubName={club.name}
              kit={clubKit(club)}
              negotiable={
                preview.state.management?.policies?.[selectedPlayerId]?.available ?? false
              }
            />
          </div>
          <PlayerManagement
            player={preview.state.players.byId[selectedPlayerId]!}
            snapshot={preview}

            planningBusy={locked}
          />
        </PlayerModal>
      )}
      {mobile &&
        mobileAction &&
        preview.state.players.byId[mobileAction.playerId]?.clubId === club.id && (
          <PlayerModal
            className="squad-action-modal"
            title={`${mobileActions.find((action) => action.id === mobileAction.section)!.label} · ${preview.state.players.byId[mobileAction.playerId]!.name}`}
            onClose={() => setMobileAction(null)}
          >
            <PlayerManagement
              key={`${mobileAction.playerId}.${mobileAction.section}`}
              player={preview.state.players.byId[mobileAction.playerId]!}
              snapshot={preview}

              planningBusy={locked}
              initialSection={mobileAction.section}
              hideTabs
            />
          </PlayerModal>
        )}
    </div>
  );
}
