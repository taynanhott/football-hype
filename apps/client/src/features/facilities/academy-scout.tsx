import { useState } from 'react';
import { clubKit, MAX_SQUAD_SIZE } from '@football/shared';
import { potentialStars } from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { Portrait } from '../players/pixel-portrait';
import { Icon } from '../../ui/icons';
import { positionLabel } from '../../ui/position-label';
import { currency } from '../../ui/format';

export function AcademyScout({ snapshot, club, center }: ViewProps) {
  const state = snapshot.state;
  const send = useGameStore((s) => s.send);
  const busy = useGameStore((s) => s.busy);
  const error = useGameStore((s) => s.error);
  const [offers, setOffers] = useState<Record<string, string>>({});
  const players = Object.values(state.players.byId)
    .filter(
      (p) =>
        p.academyClubId === club.id &&
        !p.clubId &&
        p.academyDismissedSeason === undefined &&
        p.academySeason === state.season,
    )
    .slice(0, 5);
  const promoted = Object.values(state.players.byId).filter(
    (p) =>
      p.academyClubId === club.id &&
      (p.academyPromotedSeason === state.season || p.academyDismissedSeason === state.season),
  ).length;
  return (
    <div className="academy-camp">
      <header className="academy-camp-heading">
        <Icon name="training" size={30} />
        <div>
          <span>CENTRO DE FORMAÇÃO · TEMPORADA {state.season}</span>
          <h2>O próximo craque começa aqui</h2>
        </div>
        <strong>SCOUT {center.levels.scouting}/5</strong>
      </header>
      <div className="academy-camp-summary">
        <span>{players.length}/5 em observação</span>
        <span>{Math.max(0, 3 - promoted)} reposições restantes</span>
        <span>{club.playerIds.length}/45 profissionais</span>
      </div>
      <div className="academy-training-pitch">
        {players.map((player) => {
          const negotiation = state.negotiations.find(
            (n) => n.playerId === player.id && n.buyerId === club.id && n.status === 'salary',
          );
          const stars = potentialStars(player.potential);
          return (
            <article className="academy-training-card" key={player.id}>
              <div className="academy-player-visual">
                <strong className="academy-overall">
                  {player.overall}
                  <small>OVR</small>
                </strong>
                <Portrait player={player} clubName={club.name} kit={clubKit(club)} />
                <span>{positionLabel(player.position)}</span>
              </div>
              <div className="academy-player-info">
                <h3>{player.name}</h3>
                <p>
                  {player.age} anos · Base do {club.name}
                </p>
                <span className="academy-stars" aria-label={`Potencial: ${stars} de 5 estrelas`}>
                  {'★'.repeat(stars)}
                  {'☆'.repeat(5 - stars)}
                </span>
                <small>Potencial</small>
              </div>
              {negotiation ? (
                <form
                  className="academy-salary"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const salary = Math.round(
                      Number(
                        offers[player.id] ??
                          String((negotiation.minimumSalary ?? player.salary.cents) / 100),
                      ) * 100,
                    );
                    if (Number.isFinite(salary) && salary > 0)
                      send({ type: 'salary', negotiationId: negotiation.id, salary });
                  }}
                >
                  <p>{negotiation.reply}</p>
                  <label>
                    Salário mensal (R$)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={
                        offers[player.id] ??
                        String((negotiation.minimumSalary ?? player.salary.cents) / 100)
                      }
                      onChange={(event) =>
                        setOffers({ ...offers, [player.id]: event.target.value })
                      }
                    />
                  </label>
                  <small>
                    Pretensão: {currency(negotiation.minimumSalary ?? player.salary.cents)}/mês
                  </small>
                  <button
                    className="primary"
                    disabled={busy || club.playerIds.length >= MAX_SQUAD_SIZE}
                  >
                    Oferecer contrato
                  </button>
                </form>
              ) : (
                <button
                  className="primary"
                  disabled={busy || club.playerIds.length >= MAX_SQUAD_SIZE}
                  onClick={() =>
                    send({ type: 'management', action: 'promote-academy', playerId: player.id })
                  }
                >
                  Negociar promoção <Icon name="arrow" size={16} />
                </button>
              )}
              <button
                className="academy-dismiss"
                disabled={busy}
                onClick={() =>
                  send({ type: 'management', action: 'dismiss-academy', playerId: player.id })
                }
              >
                Dispensar
              </button>
            </article>
          );
        })}
        {!players.length && <p className="academy-empty">Observação encerrada nesta temporada.</p>}
      </div>
      {club.playerIds.length >= MAX_SQUAD_SIZE && (
        <p>Libere uma vaga no profissional para promover um atleta.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
