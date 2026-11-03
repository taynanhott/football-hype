import { marketValue } from '../../ui/format';
import { PixelBadge } from '../../ui/pixel-badge';
import { useCollapsedPlayerCategories } from '../../ui/use-collapsed-player-categories';
import { usePlayerPositionFilter } from '../../ui/use-player-position-filter';
import { usePlayerPresentation } from '../../ui/use-player-presentation';
import {
  compareFieldPosition,
  playerCategoryHeading,
  playerPositionCategory,
} from './field-position-order';
import { currency } from '../../ui/format';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { clubKit } from '@football/shared';
import { temporaryModifiers, renewalTerms, contractEnd } from '@football/domain';
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
  { id: 'renew', label: 'Renegociação' },
] as const;

export function SquadPlanning({ snapshot, club }: ViewProps) {
  const [view, setView] = usePlayerPresentation();
  const [position, setPosition] = usePlayerPositionFilter('squad');
  const [collapsedList, toggleListCategory] = useCollapsedPlayerCategories('squad');
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const [mobileExpanded, setExpanded] = useState<string[]>([]);
  const [desktopCollapsed, setDesktopCollapsed] = useState<string[]>([]);
  const expanded = mobile
    ? mobileExpanded
    : [
        'Goleiros',
        'Zagueiros',
        'Laterais',
        'Volantes',
        'Meias',
        'Pontas',
        'Atacantes',
        'Outros',
      ].filter((category) => !desktopCollapsed.includes(category));
  function toggleCategory(category: string) {
    if (!mobile) {
      setDesktopCollapsed((previous) =>
        previous.includes(category)
          ? previous.filter((item) => item !== category)
          : [...previous, category],
      );
      return;
    }
    const opening = !expanded.includes(category);
    setExpanded(opening ? [category] : []);
    if (opening)
      requestAnimationFrame(() => {
        const roster = document.querySelector('.squad-office-roster');
        const container = roster?.querySelector<HTMLElement>(
          '.squad-office-players, .squad-planning-list',
        );
        const heading = container?.querySelector<HTMLElement>(
          'button.squad-list-category[aria-expanded="true"]',
        );
        if (container && heading) {
          const group = heading.parentElement!;
          const content = group.querySelector<HTMLElement>('.squad-category-players');
          if (content) {
            content.scrollTop = 0;
            content.style.setProperty('--category-clip-top', '12px');
          }
          const offset =
            group.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop;
          container.scrollTo({ top: offset, behavior: 'instant' });
        }
      });
  }
  useEffect(() => {
    if (!mobile) return;
    const roster = document.querySelector('.squad-office-roster');
    const container = roster?.querySelector<HTMLElement>(
      '.squad-office-players, .squad-planning-list',
    );
    if (!container) return;
    let frame = 0;
    const update = () => {
      const heading = container.querySelector<HTMLElement>(
        '.squad-category-group > button[aria-expanded="true"]',
      );
      const content = heading?.parentElement?.querySelector<HTMLElement>('.squad-category-players');
      if (heading && content) {
        const inset = Math.max(
          12,
          heading.getBoundingClientRect().bottom + 12 - content.getBoundingClientRect().top,
        );
        content.style.setProperty('--category-clip-top', inset + 'px');
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    container.addEventListener('scroll', schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      container.removeEventListener('scroll', schedule);
    };
  }, [expanded, view, position, mobile]);
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
    .filter((p) => position === 'ALL' || p.position === position);
  players.sort(compareFieldPosition);
  const groups = [
    ...new Set(players.map((player) => playerPositionCategory(player.position).title)),
  ].map((title) =>
    players.filter((player) => playerPositionCategory(player.position).title === title),
  );
  return (
    <div className="squad-office">
      <section className="squad-office-roster" aria-label="Jogadores do elenco">
        <div className="squad-office-controls">
          <div className="squad-view-field">
            <span id="squad-view-label">Visualização</span>
            <div className="segmented" role="group" aria-labelledby="squad-view-label">
              <button
                type="button"
                aria-pressed={view === 'cards'}
                onClick={() => setView('cards')}
              >
                Cartas
              </button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                Lista
              </button>
            </div>
          </div>
          <label>
            Posição
            <Select value={position} onValueChange={setPosition} aria-label="Posição">
              <Option value="ALL">Todas</Option>
              {[
                'GK',
                'CB',
                'RB',
                'LB',
                'RWB',
                'LWB',
                'DM',
                'CM',
                'RM',
                'LM',
                'AM',
                'RW',
                'LW',
                'SS',
                'ST',
              ]
                .filter((p) =>
                  club.playerIds.some((id) => snapshot.state.players.byId[id]?.position === p),
                )
                .map((p) => (
                  <Option key={p} value={p}>
                    {positionLabel(p)}
                  </Option>
                ))}
            </Select>
          </label>
        </div>
        {view === 'list' ? (
          <div className="squad-planning-list">
            {groups.map((group) => {
              const player = group[0]!;
              const index = players.indexOf(player);
              return (
                <section
                  className="squad-category-group"
                  key={playerPositionCategory(player.position).title}
                >
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
                    hidden={collapsedList.includes(playerPositionCategory(player.position).title)}
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
                          <strong>
                            {player.name} - {positionLabel(player.position)}
                            {playerAlert(player) && (
                              <span
                                className="squad-notification-dot squad-player-alert"
                                role="img"
                                aria-label="Jogador com proposta, pedido de renegociação ou contrato no fim"
                              />
                            )}
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
                                Potencial <b>{player.potential}</b>
                              </span>
                              <span>
                                À venda{' '}
                                <b>
                                  {preview.state.management?.policies?.[player.id]?.available
                                    ? 'Sim'
                                    : 'Não'}
                                </b>
                              </span>
                              <span>
                                Idade <b>{player.age} anos</b>
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
        ) : (
          <div className="squad-office-players">
            {groups.map((group) => {
              const player = group[0]!;
              const index = players.indexOf(player);
              return (
                <section
                  className="squad-category-group"
                  key={playerPositionCategory(player.position).title}
                >
                  {playerCategoryHeading(players, index) && (
                    <button
                      type="button"
                      className="squad-list-category squad-card-category"
                      aria-expanded={expanded.includes(
                        playerPositionCategory(player.position).title,
                      )}
                      onClick={() => toggleCategory(playerPositionCategory(player.position).title)}
                    >
                      <span>
                        {expanded.includes(playerPositionCategory(player.position).title)
                          ? '▾'
                          : '▸'}{' '}
                        {playerCategoryHeading(players, index)}
                      </span>
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
                    hidden={!expanded.includes(playerPositionCategory(player.position).title)}
                  >
                    {group.map((player) => (
                      <article
                        className="squad-office-player"
                        key={player.id}
                        hidden={!expanded.includes(playerPositionCategory(player.position).title)}
                      >
                        <div className="squad-contract-top">
                          <span>Vencimento do contrato</span>
                          <strong>
                            {new Date(contractEnd(preview.state, player)).toLocaleDateString(
                              'pt-BR',
                              { timeZone: 'America/Sao_Paulo' },
                            )}
                          </strong>
                          <small>
                            {Math.max(
                              0,
                              Math.ceil(
                                (contractEnd(preview.state, player) -
                                  preview.state.lastProcessedAt) /
                                  86400000,
                              ),
                            )}{' '}
                            dias restantes
                          </small>
                        </div>
                        <div className="squad-office-card">
                          <PlayerCard
                            player={player}
                            clubName={club.name}
                            kit={clubKit(club)}
                            contractExpiring={
                              Math.max(
                                0,
                                Math.ceil(
                                  (contractEnd(preview.state, player) -
                                    preview.state.lastProcessedAt) /
                                    (30 * 86400000),
                                ),
                              ) <= 6
                            }
                            negotiable={
                              preview.state.management?.policies?.[player.id]?.available ?? false
                            }
                            rivalNegotiationBlocked={Boolean(
                              preview.state.management?.policies?.[player.id]?.available &&
                              !preview.state.management?.policies?.[player.id]?.rivals,
                            )}
                          />
                        </div>
                        <div className="squad-office-actions">
                          {mobile ? (
                            <div
                              className="squad-mobile-action-buttons"
                              aria-label={`Ações de ${player.name}`}
                            >
                              {mobileActions.map((action) => (
                                <button
                                  type="button"
                                  key={action.id}
                                  disabled={
                                    locked ||
                                    (action.id === 'effects' &&
                                      !temporaryModifiers(preview.state, player).length) ||
                                    (action.id === 'renew' &&
                                      Boolean(renewalTerms(preview.state, player).reason))
                                  }
                                  aria-haspopup="dialog"
                                  onClick={() =>
                                    setMobileAction({ playerId: player.id, section: action.id })
                                  }
                                >
                                  {action.label}
                                  {action.id === 'renew' &&
                                    (renewalTerms(preview.state, player).demand ||
                                      contractEnd(preview.state, player) -
                                        preview.state.lastProcessedAt <=
                                        180 * 86400000) && (
                                      <span
                                        className="squad-notification-dot"
                                        aria-label="Renovação pendente"
                                      />
                                    )}
                                  {action.id === 'policy' &&
                                    snapshot.state.management?.offers?.some(
                                      (offer) =>
                                        offer.playerId === player.id &&
                                        offer.sellerId === club.id &&
                                        offer.status === 'pending',
                                    ) && (
                                      <span
                                        className="transfer-alert-dot"
                                        aria-label="Proposta recebida para este jogador"
                                      />
                                    )}
                                  <svg
                                    viewBox="0 0 24 24"
                                    width="26"
                                    height="26"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    aria-hidden="true"
                                  >
                                    {action.id === 'effects' ? (
                                      <>
                                        <path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z" />
                                        <path d="m8 12 3 3 5-6" />
                                      </>
                                    ) : action.id === 'policy' ? (
                                      <path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" />
                                    ) : (
                                      <>
                                        <path d="M5 3h10l4 4v14H5ZM14 3v5h5M8 12h8M8 16h6" />
                                      </>
                                    )}
                                  </svg>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <PlayerManagement
                              player={player}
                              snapshot={preview}

                              planningBusy={locked}
                            />
                          )}
                        </div>
                      </article>
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
      {selectedPlayerId && preview.state.players.byId[selectedPlayerId] && (
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
          <PlayerManagement
            player={preview.state.players.byId[selectedPlayerId]!}
            snapshot={preview}

            planningBusy={locked}
          />
        </PlayerModal>
      )}
      {mobile && mobileAction && preview.state.players.byId[mobileAction.playerId] && (
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
