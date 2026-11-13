import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/game-store';
import { Icon } from '../../ui/icons';
import { openModalPreservingScroll } from '../../ui/modal-scroll';

export function AdvanceRoundButton({
  disabled = false,
  newSeason = false,
}: {
  disabled?: boolean;
  newSeason?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const send = useGameStore((state) => state.send);
  const advancing = useGameStore((state) => state.advancing);
  return (
    <>
      <button
        className="primary advance-round-button"
        disabled={disabled || advancing}
        aria-busy={advancing}
        onClick={() => setOpen(true)}
      >
        {advancing
          ? newSeason
            ? 'Iniciando temporada...'
            : 'Avançando rodada...'
          : newSeason
            ? 'Iniciar nova temporada'
            : 'Avançar rodada'}
        {advancing ? (
          <span className="career-save-spinner" aria-hidden="true" />
        ) : (
          <Icon name="arrow" />
        )}
      </button>
      {open && (
        <RoundConfirmation
          disabled={disabled || advancing}
          newSeason={newSeason}
          onClose={() => setOpen(false)}
          onConfirm={() => {
            setOpen(false);
            send({ type: newSeason ? 'new-season' : 'advance' });
          }}
        />
      )}
    </>
  );
}

function RoundConfirmation({
  disabled,
  newSeason,
  onClose,
  onConfirm,
}: {
  disabled: boolean;
  newSeason: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => openModalPreservingScroll(dialog.current), []);
  return (
    <dialog
      ref={dialog}
      className="modal career-confirm-dialog round-confirm-dialog compact-content-modal"
      onCancel={onClose}
      aria-labelledby="advance-round-title"
    >
      <Icon name="calendar" size={30} />
      <h2 id="advance-round-title">
        {newSeason ? 'Iniciar nova temporada?' : 'Avançar a rodada?'}
      </h2>
      <p>
        {newSeason
          ? 'A liga começará uma nova temporada.'
          : 'A próxima rodada será antecipada para todos os participantes da liga.'}
      </p>
      <div className="career-confirm-actions">
        <button className="career-confirm-danger" disabled={disabled} onClick={onConfirm}>
          Sim, {newSeason ? 'iniciar' : 'avançar'}
        </button>
        <button className="secondary" autoFocus onClick={onClose}>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}
