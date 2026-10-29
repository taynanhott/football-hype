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
  return (
    <>
      <button className="primary" disabled={disabled} onClick={() => setOpen(true)}>
        {newSeason ? 'Iniciar nova temporada' : 'Avançar rodada'}
        <Icon name="arrow" />
      </button>
      {open && (
        <RoundConfirmation
          disabled={disabled}
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
      className="modal career-confirm-dialog"
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
