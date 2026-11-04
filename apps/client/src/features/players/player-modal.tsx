import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function PlayerModal({
  title,
  titleIcon,
  onClose,
  children,
  className = '',
  hideTitle = false,
  hideClose = false,
}: {
  title: string;
  titleIcon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
  hideClose?: boolean;
}) {
  // Only fixed, short workflows use intrinsic sizing; lists and expandable forms retain their layout.
  const compact = className
    .split(/\s+/)
    .some((name) =>
      [
        'career-confirm-dialog',
        'facility-confirmation',
        'individual-training-confirm',
        'withdraw-offer-confirm',
        'discard-training-confirm',
      ].includes(name),
    );
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    return openModalPreservingScroll(ref.current);
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal player-management-modal ${className} ${compact ? 'compact-content-modal' : ''}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        {!hideTitle && (
          <h2 className="modal-title">
            {titleIcon}
            {title}
          </h2>
        )}
        {children}
      </div>
      {!hideClose && (
        <button className="modal-return" aria-label="Fechar" onClick={onClose}>
          ← Voltar
        </button>
      )}
    </dialog>
  );
}
