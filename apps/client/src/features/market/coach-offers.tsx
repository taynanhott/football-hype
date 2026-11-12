import { clubCoachProposals } from './club-coach-proposals';
import { ClubBadge, Icon } from '../../ui/icons';
import { coachTable } from '@football/domain';
import { useEffect, useRef, useState } from 'react';
import { openModalPreservingScroll } from '../../ui/modal-scroll';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { currency } from '../../ui/format';
export function CoachOffers({ snapshot, club }: ViewProps) {
  const send = useGameStore((s) => s.send),
    busy = useGameStore((s) => s.busy);
  const [confirming, setConfirming] = useState<{ id: string; accept: boolean } | null>(null);
  const state = snapshot.state;
  const cards = clubCoachProposals(state, club.id);
  return (
    <section className="incoming-offers coach-offers" data-presentation="list">
      <div className="incoming-offers-grid coach-offers-grid">
        {cards.map(({ id, team }) => {
          if (!team) return null;
          const players = team.playerIds.map((id) => state.players.byId[id]).filter((p) => !!p);
          const overall = players.length
            ? players.reduce((sum, p) => sum + p.overall, 0) / players.length
            : 0;
          const position = coachTable(state, team.id).findIndex((r) => r.id === team.id) + 1;
          return (
            <article key={id} className="incoming-offer coach-proposal">
              <header className="offer-buyer">
                <ClubBadge name={team.name} size={40} />
                <div>
                  <span>CLUBE INTERESSADO</span>
                  <a href={'#/trophies?club=' + team.id}>{team.name} ↗</a>
                </div>
                <span className="offer-status">Pendente</span>
              </header>
              <div className="offer-body">
                <div className="coach-proposal-crest" role="img" aria-label="Troca de treinador">
                  <Icon name="coach-transfer" size={72} />
                </div>
                <div className="incoming-offer-details">
                  <span className="eyebrow">PROPOSTA DE TROCA DE TREINADOR</span>
                  <h3>{team.name}</h3>
                  <p>
                    Série {team.division} ·{' '}
                    {position > 0 ? position + 'º lugar' : 'Sem classificação'} · Média geral{' '}
                    {overall.toFixed(1)}
                  </p>
                  <div className="offer-amount">
                    <span>Saldo em caixa</span>
                    <strong>{currency(team.balance.cents)}</strong>
                  </div>
                </div>
              </div>
              <footer className="offer-actions">
                <span>A decisão é sua</span>
                <button
                  className="negotiate-button"
                  disabled={busy}
                  onClick={() => setConfirming({ id, accept: true })}
                >
                  Aceitar proposta
                </button>
                <button
                  className="secondary coach-offer-reject"
                  disabled={busy}
                  onClick={() => setConfirming({ id, accept: false })}
                >
                  Recusar
                </button>
                {confirming?.id === id && (
                  <CoachOfferConfirmation
                    teamName={team.name}
                    currentClubName={club.name}
                    accept={confirming.accept}
                    busy={busy}
                    onClose={() => setConfirming(null)}
                    onConfirm={() => {
                      send({ type: 'coach-offer', offerId: id, accept: confirming.accept });
                      setConfirming(null);
                    }}
                  />
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CoachOfferConfirmation({
  teamName,
  currentClubName,
  accept,
  busy,
  onClose,
  onConfirm,
}: {
  teamName: string;
  currentClubName: string;
  accept: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => openModalPreservingScroll(dialog.current), []);
  return (
    <dialog
      ref={dialog}
      className="modal career-confirm-dialog compact-content-modal coach-offer-confirmation"
      onCancel={onClose}
      aria-labelledby="coach-offer-confirm-title"
      aria-describedby="coach-offer-confirm-description"
    >
      <div className="coach-confirm-crest">
        <ClubBadge name={teamName} size={112} />
      </div>
      <h2 id="coach-offer-confirm-title">
        {accept ? 'Aceitar proposta de treinador?' : 'Recusar proposta de treinador?'}
      </h2>
      {!accept && (
        <p id="coach-offer-confirm-description" className="coach-board-message">
          “Queremos você à frente do nosso projeto. Ainda temos muito a conquistar juntos, e sua
          permanência é importante para o futuro do clube.”
          <br />
          <strong>Diretoria do {currentClubName}</strong>
        </p>
      )}
      {accept && (
        <p id="coach-offer-confirm-description" className="coach-board-message">
          “Acreditamos no seu trabalho e queremos construir uma nova fase de conquistas com você à
          frente do nosso clube.”
          <br />
          <strong>Diretoria do {teamName}</strong>
        </p>
      )}
      <div className="career-confirm-actions">
        <button
          className={accept ? 'negotiate-button' : 'career-confirm-danger'}
          disabled={busy}
          onClick={onConfirm}
        >
          {accept ? 'Confirmar troca' : 'Confirmar recusa'}
        </button>
        <button className="secondary" autoFocus onClick={onClose}>
          Voltar
        </button>
      </div>
    </dialog>
  );
}
