import { positionLabel } from '../../ui/position-label';
import { Overall } from './overall';
import { potentialStars } from '@football/domain';
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { PlayerSnapshot, ClubKit } from '@football/shared';
import { Portrait } from './pixel-portrait';
import { currency } from '../../ui/format';

export { Portrait } from './pixel-portrait';
export function PlayerCard({
  player,
  clubName,
  kit,
  initiallyFlipped = false,
  hidePotential = false,
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
  hidePotential?: boolean;
  onActivate?: () => void;
}) {
  const [flipped, setFlipped] = useState(initiallyFlipped);
  const tier =
    player.overall <= 69
      ? 'bronze'
      : player.overall <= 77
        ? 'silver'
        : player.overall <= 85
          ? 'gold'
          : 'diamond';
  const tierName = { bronze: 'Bronze', silver: 'Prata', gold: 'Ouro', diamond: 'Diamante' }[tier];
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
      data-tier={tier}
      aria-label={`${onActivate ? 'Detalhes' : flipped ? 'Ver frente' : 'Ver atributos'} de ${player.name} · ${tierName} · Overall ${player.overall}`}
      aria-pressed={flipped}
      onClick={() => {
        if (onActivate) onActivate();
        else setFlipped(!flipped);
      }}
    >
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
      <motion.div
        className="card-inner"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.55 }}
      >
        <div className="card-front">
          <div className="card-rank">
            <strong>
              <Overall base={player.overall} modifier={modifier} />
            </strong>
            <span>{positionLabel(player.position)}</span>
          </div>
          <span className="card-country">{player.nationality}</span>
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
          <span className="eyebrow">PERFIL DO ATLETA · {tierName.toUpperCase()}</span>
          <h3>{player.name}</h3>
          <dl>
            {[
              ['Moral', `${player.morale}%`],
              ['Forma física', `${player.fitness}%`],
              ['Overall', <Overall base={player.overall} modifier={modifier} />],
              [
                'Potencial',
                hidePotential ? (
                  <span
                    className="potential-stars"
                    role="img"
                    aria-label={`Potencial: ${potentialStars(player.potential)} de 5 estrelas`}
                  >
                    {'★'.repeat(potentialStars(player.potential))}
                    <span className="potential-stars-empty">
                      {'☆'.repeat(5 - potentialStars(player.potential))}
                    </span>
                  </span>
                ) : (
                  player.potential
                ),
              ],
              ['Time', clubName],
              ['Idade', `${player.age} anos`],
              ['Nacionalidade', player.nationality],
              ['Valor de mercado', currency(player.marketValue.cents)],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>
                  {label === 'Time' && player.clubId ? (
                    <a
                      href={'#/trophies?club=' + player.clubId}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </motion.div>
    </div>
  );
}
