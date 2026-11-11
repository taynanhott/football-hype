import { UnavailablePlayers } from './match-instructions';
import { showDraggedCard, startCardPointerDrag } from '../../ui/card-drag';
import { positionLabel } from '../../ui/position-label';
import { Icon } from '../../ui/icons';
import { cardPlayerName } from './card-player-name';
import { clubUnavailablePlayers } from './player-availability';
import { useState } from 'react';
import type { ClubSnapshot, PlayerSnapshot, WorldState } from '@football/shared';
import { clubKit } from '@football/shared';
import {
  effectiveOverall,
  temporaryModifiers,
  playerSuspension,
  medicallyAvailable,
} from '@football/domain';
import { Overall } from './overall';
import { Portrait } from './pixel-portrait';
import { PlayerCard } from './player-card';
import { PlayerModal } from './player-modal';

export function MatchBench({
  state,
  club,
  starters: requestedStarters,
  reserves: requestedReserves,
  onChange,
  onMove,
}: {
  state: WorldState;
  club: ClubSnapshot;
  starters: string[];
  reserves: string[];
  onChange: (ids: string[]) => void;
  onMove?: (id: string, target: string | null, related: boolean) => void;
}) {
  const [selected, setSelected] = useState<PlayerSnapshot | null>(null);
  const orderKey = 'football.bench-order.' + state.id + '.' + club.id;
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(orderKey) ?? '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  const orderedIds = [
    ...new Set([...customOrder.filter((id) => club.playerIds.includes(id)), ...club.playerIds]),
  ];
  const unavailableIds = new Set(clubUnavailablePlayers(state, club).map((player) => player.id));
  const starters = requestedStarters.filter((id) => !unavailableIds.has(id));
  const reserves = requestedReserves.filter((id) => !unavailableIds.has(id));
  const players = orderedIds.flatMap((id) =>
    state.players.byId[id] && !starters.includes(id) ? [state.players.byId[id]!] : [],
  );
  const available = (player: PlayerSnapshot) => !unavailableIds.has(player.id);
  const moveCard = (id: string, targetId: string | null, related: boolean) => {
    if (
      id === targetId ||
      !club.playerIds.includes(id) ||
      unavailableIds.has(id) ||
      (targetId !== null && unavailableIds.has(targetId))
    )
      return;
    if (!starters.includes(id) && reserves.includes(id) === related) {
      const list = related
        ? [...reserves]
        : players.filter((player) => !reserves.includes(player.id)).map((player) => player.id);
      const from = list.indexOf(id);
      const to = targetId ? list.indexOf(targetId) : -1;
      if (from < 0 || to < 0) return;
      [list[from], list[to]] = [list[to]!, list[from]!];
      if (related) onChange(list);
      const others = orderedIds.filter((id) => !list.includes(id));
      const next = [...list, ...others];
      setCustomOrder(next);
      try {
        localStorage.setItem(orderKey, JSON.stringify(next));
      } catch {
        /* Ordering still works for this session. */
      }
      return;
    }
    onMove?.(id, targetId, related);
  };
  const included = selected ? reserves.includes(selected.id) : false;
  const candidates = players.filter(
    (player) =>
      available(player) && player.id !== selected?.id && reserves.includes(player.id) !== included,
  );
  return (
    <section className="reserve-roster" aria-label="Banco de reservas">
      {[true, false].map((related) => (
        <details
          className={`reserve-section ${related ? 'related' : 'unrelated'}`}
          key={String(related)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            moveCard(event.dataTransfer.getData('text/plain'), null, related);
          }}
        >
          <summary className="reserve-section-heading">
            <h2>{related ? 'Reservas' : 'Não relacionados'}</h2>
            <span>
              {related
                ? `${reserves.length}/12 atletas`
                : `${players.filter((player) => !reserves.includes(player.id)).length} atletas`}
            </span>
            <span className="reserve-toggle" aria-hidden="true">
              <Icon name="chevron-down" size={16} />
            </span>
          </summary>
          <div className="reserve-cards">
            {players
              .filter((player) => reserves.includes(player.id) === related)
              .sort((a, b) => (related ? reserves.indexOf(a.id) - reserves.indexOf(b.id) : 0))
              .map((player) => (
                <button
                  data-drag-player-id={player.id}
                  draggable={available(player)}
                  disabled={!available(player)}
                  aria-disabled={!available(player)}
                  onPointerDown={(event) => {
                    if (!available(player)) return;
                    startCardPointerDrag(event, player.id);
                  }}
                  onDragStart={(event) => {
                    if (!available(player)) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.setData('text/plain', player.id);
                    event.dataTransfer.effectAllowed = 'move';
                    showDraggedCard(event);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    moveCard(event.dataTransfer.getData('text/plain'), player.id, related);
                  }}
                  type="button"
                  className={`reserve-mini${available(player) ? '' : ' reserve-mini-unavailable'}`}
                  data-tier={
                    player.overall <= 69
                      ? 'bronze'
                      : player.overall <= 77
                        ? 'silver'
                        : player.overall <= 85
                          ? 'gold'
                          : 'diamond'
                  }
                  key={player.id}
                  onClick={() => setSelected(player)}
                  aria-label={`${!available(player) ? 'Indisponível:' : related ? 'Substituir reserva' : 'Relacionar'} ${player.name}`}
                >
                  <span className="reserve-mini-rating">
                    <Overall
                      base={player.overall}
                      modifier={effectiveOverall(state, player) - player.overall}
                    />
                    <small>{positionLabel(player.position)}</small>
                  </span>
                  <span className="reserve-mini-portrait">
                    <Portrait player={player} clubName={club.name} kit={clubKit(club)} />
                  </span>
                  <strong title={player.name}>{cardPlayerName(player.name)}</strong>
                  <span className="reserve-mini-fitness">
                    {available(player)
                      ? `${Math.round(player.fitness)}% COND`
                      : !medicallyAvailable(state, player.id)
                        ? 'Lesionado'
                        : playerSuspension(state, player.id)
                          ? 'Suspenso'
                          : 'Convocado'}
                    {available(player) && <i style={{ width: `${player.fitness}%` }} />}
                  </span>
                </button>
              ))}
            {!players.some((player) => reserves.includes(player.id) === related) && (
              <p className="reserve-empty">
                {related
                  ? 'Nenhum reserva disponível.'
                  : 'Todos os atletas disponíveis estão relacionados.'}
              </p>
            )}
          </div>
        </details>
      ))}
      <UnavailablePlayers state={state} club={club} />
      {selected && (
        <PlayerModal
          className="lineup-selection-modal"
          title={`${selected.name} · ${positionLabel(selected.position)}`}
          onClose={() => setSelected(null)}
        >
          <div className="lineup-selection-grid">
            <div className="lineup-player-detail">
              <PlayerCard
                player={selected}
                clubName={club.name}
                kit={clubKit(club)}
                modifier={effectiveOverall(state, selected) - selected.overall}
              />
              <div className="lineup-effects">
                <h3>O que afeta este jogador</h3>
                {!temporaryModifiers(state, selected).length && (
                  <p>Sem bônus ou penalidades nesta posição.</p>
                )}
                {temporaryModifiers(state, selected).map((effect) => (
                  <p key={effect.label} className={effect.value > 0 ? 'positive' : 'negative'}>
                    <b>
                      {effect.value > 0 ? '+' : ''}
                      {effect.value} · {effect.label}
                    </b>
                    <small>{effect.until}</small>
                  </p>
                ))}
              </div>
            </div>
            <section className="lineup-bench">
              <span className="eyebrow">BANCO DE RESERVAS</span>
              <h2>{included ? 'Substituir por quem?' : 'Trocar por qual reserva?'}</h2>
              <p>Escolha o atleta para trocar entre relacionados e não relacionados.</p>
              {!included && reserves.length < 12 && available(selected) && (
                <button
                  className="primary"
                  onClick={() => {
                    onChange([...reserves, selected.id]);
                    setSelected(null);
                  }}
                >
                  Relacionar na vaga livre
                </button>
              )}
              <div className="bench-list">
                {candidates.map((player) => (
                  <button
                    type="button"
                    className="bench-player starter"
                    key={player.id}
                    disabled={!available(player) || (!included && !available(selected))}
                    onClick={() => {
                      onChange(
                        included
                          ? reserves.map((id) => (id === selected.id ? player.id : id))
                          : reserves.map((id) => (id === player.id ? selected.id : id)),
                      );
                      setSelected(null);
                    }}
                  >
                    <Portrait player={player} clubName={club.name} kit={clubKit(club)} />
                    <span>
                      <strong>{player.name}</strong>
                      <small>
                        {positionLabel(player.position)} · OVR {player.overall} · Condição{' '}
                        {player.fitness}%
                      </small>
                    </span>
                    <b>Trocar</b>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </PlayerModal>
      )}
    </section>
  );
}
