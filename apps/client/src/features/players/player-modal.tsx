import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function PlayerModal({
  title,
  onClose,
  children,
  className = '',
  hideTitle = false,
  hideClose = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
  hideClose?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    return openModalPreservingScroll(ref.current);
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal player-management-modal ${className}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        {!hideTitle && <h2>{title}</h2>}
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
