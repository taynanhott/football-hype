import { cardShineStyle } from './card-shine';
import { useScoutingReport } from './use-scouting-report';
import { Icon } from '../../ui/icons';
import { CountryFlag } from '../../ui/country-flag';
import { useGameStore } from '../../store/game-store';
import { marketValue } from '../../ui/format';
import { positionLabel } from '../../ui/position-label';
import { Overall } from './overall';
import { contractEnd, renewalTerms } from '@football/domain';
import { playerCardStats } from './player-card-stats';
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { PlayerSnapshot, ClubKit } from '@football/shared';
import { Portrait } from './pixel-portrait';

export { Portrait } from './pixel-portrait';
export function PlayerCard({
  player,
  clubName,
  kit,
  initiallyFlipped = false,
  onActivate,
  modifier = 0,
  negotiable = false,
  contractMonths,
  contractExpiring = false,
  rivalNegotiationBlocked = false,
}: {
  modifier?: number;
  negotiable?: boolean;
  contractMonths?: number;
  contractExpiring?: boolean;
  rivalNegotiationBlocked?: boolean;
  player: PlayerSnapshot;
  clubName: string;
  kit?: ClubKit | undefined;
  initiallyFlipped?: boolean;
  onActivate?: () => void;
}) {
  const report = useScoutingReport()(player);
  const world = useGameStore((store) => store.snapshot?.state);
  const stats = world ? playerCardStats(world, player.id) : null;
  const remainingMonths =
    contractMonths ??
    (world && player.clubId
      ? Math.max(
          0,
          Math.ceil((contractEnd(world, player) - world.lastProcessedAt) / (30 * 86400000)),
        )
      : undefined);
  const score = (value: number | null | undefined) =>
    value == null
      ? '—'
      : value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const renewalRequested = useGameStore((store) => {
    const world = store.snapshot?.state;
    return world && player.clubId && world.participants.some((p) => p.clubId === player.clubId)
      ? renewalTerms(world, player).demand
      : false;
  });
  const [flipped, setFlipped] = useState(initiallyFlipped);
  const loanAvailable = useGameStore(
    (state) => state.snapshot?.state.management?.policies?.[player.id]?.loanAvailable ?? false,
  );
  const injuryGames = useGameStore((state) => state.snapshot?.state.injuries[player.id] ?? 0);
  const tier = report.tier;
  const tierName = {
    bronze: 'Bronze',
    silver: 'Prata',
    gold: 'Ouro',
    diamond: 'Diamante',
    unknown: 'Não avaliado',
  }[tier];
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          if (onActivate) onActivate();
          else setFlipped(!flipped);
        }
      }}
      className={`player-card ${flipped ? 'is-flipped' : ''}`}
      style={cardShineStyle(player.id)}
      data-tier={tier}
      aria-label={`${onActivate ? 'Detalhes' : flipped ? 'Ver frente' : 'Ver atributos'} de ${player.name} · ${tierName} · Overall ${report.overall}`}
      aria-pressed={flipped}
      onClick={() => {
        if (onActivate) onActivate();
        else setFlipped(!flipped);
      }}
    >
      {renewalRequested && (
        <span
          className="card-renewal-request"
          title="Jogador pede renovação"
          aria-label="Jogador pede renovação"
        >
          <Icon name="salary-demand" size={19} />
        </span>
      )}
      {contractExpiring && (
        <span
          className="card-contract-alert"
          title="Contrato vence nesta temporada"
          aria-label="Contrato vence nesta temporada"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2v20M17 5H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H5" />
          </svg>
        </span>
      )}
      {rivalNegotiationBlocked && (
        <span
          className="card-rival-lock"
          title="Negociação com rivais bloqueada"
          aria-label="Negociação com rivais bloqueada"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
          </svg>
        </span>
      )}
      {negotiable && (
        <span
          className="card-negotiable"
          title="Disponível para negociação"
          aria-label="Disponível para negociação"
        >
          $
        </span>
      )}
      {loanAvailable && (
        <span
          className={`card-negotiable card-loan-available${negotiable ? ' with-transfer' : ''}`}
          title="Disponível para empréstimo"
          aria-label="Disponível para empréstimo"
        >
          $
        </span>
      )}
      {injuryGames > 0 && (
        <span
          className="card-injury"
          title={`Lesionado · ${injuryGames} jogos`}
          aria-label={`Lesionado · ${injuryGames} jogos`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" />
          </svg>
        </span>
      )}
      <motion.div
        className="card-inner"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55 }}
      >
        <div className="card-front">
          <span className="player-card-shine" aria-hidden="true" />
          <div className="card-rank">
            <strong>
              <Overall base={report.overall} modifier={modifier} />
            </strong>
            <span>{positionLabel(player.position)}</span>
          </div>
          <span className="card-country">{<CountryFlag country={player.nationality} />}</span>
          <Portrait player={player} clubName={clubName} kit={kit} />
          <div className="card-label">
            <h3>{player.name}</h3>
            <p>
              {player.clubId ? (
                <a href={'#/trophies?club=' + player.clubId} onClick={(e) => e.stopPropagation()}>
                  {clubName}
                </a>
              ) : (
                clubName
              )}{' '}
              · {player.age} anos
            </p>
            {contractMonths !== undefined && (
              <small
                className={
                  contractExpiring ? 'card-contract-months is-urgent' : 'card-contract-months'
                }
                title="Tempo restante de contrato"
              >
                Contrato · {contractMonths}m
              </small>
            )}
            <span>{onActivate ? 'DETALHES DO JOGADOR ↗' : 'VIRAR CARTA ↻'}</span>
          </div>
        </div>
        <div className="card-back">
          <h3>{player.name}</h3>
          <div className="reverse-identity">
            <b>{positionLabel(player.position)}</b> {player.age} ANOS
          </div>
          <div className="reverse-metrics">
            {[
              ['Moral', player.morale],
              ['Condição', player.fitness],
              ['Forma (5 jogos)', score(stats?.form)],
              ['Potencial', report.potential],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <strong>{value}</strong>
                <small>{label}</small>
                <i />
              </div>
            ))}
          </div>
          <div className="reverse-stats">
            {[
              ['Jogos', stats?.games ?? player.appearances, 'ᵛˢ'],
              ['Gols', stats?.goals ?? 0, <Icon key="goal" name="ball" size={16} />],
              ['Assist.', stats?.assists ?? 0, '➜'],
              ['Nota', score(stats?.average), '★'],
              ['Min.', stats?.minutes ?? 0, '◷'],
              ['Amar.', stats?.yellow ?? 0, '▮'],
            ].map(([label, value, icon]) => (
              <div key={String(label)}>
                <span>{icon}</span>
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
          <div className="reverse-facts">
            {[
              [
                'Clube',
                player.clubId ? (
                  <a
                    className="player-club-access"
                    href={'#/trophies?club=' + player.clubId}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {clubName}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                ) : (
                  clubName
                ),
              ],
              ['País', <CountryFlag country={player.nationality} />],
              [
                'Contrato',
                !player.clubId
                  ? 'Sem vínculo'
                  : remainingMonths === undefined
                    ? '—'
                    : remainingMonths + ' meses',
              ],
              ['Valor', marketValue(player.marketValue.cents)],
              ['Salário', marketValue(player.salary.cents)],
              [
                'Faixa etária',
                player.age <= 23 ? 'Jovem' : player.age >= 30 ? 'Veterano' : 'Adulto',
              ],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
