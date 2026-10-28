import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function PlayerModal({
  title,
  onClose,
  children,
  className = '',
  hideTitle = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
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
      <button className="close-modal" aria-label="Fechar" onClick={onClose}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
      {!hideTitle && <h2>{title}</h2>}
      {children}
    </dialog>
  );
}
