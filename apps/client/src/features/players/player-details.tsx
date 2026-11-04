import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { useEffect, useRef } from 'react';
import type { ClubSnapshot, PlayerSnapshot } from '@football/shared';
import { clubKit } from '@football/shared';
import { useGameStore } from '../../store/game-store';
import { PlayerCard } from './player-card';
export function PlayerDetails({
  player,
  club,
  onClose,
}: {
  player: PlayerSnapshot;
  club: ClubSnapshot | undefined;
  onClose: () => void;
}) {
  const ownClubId = useGameStore(
    (s) => s.snapshot?.state.participants.find((p) => p.userId === s.userId)?.clubId,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    return openModalPreservingScroll(dialog.current);
  }, []);
  return (
    <dialog
      ref={dialog}
      className="player-card-overlay"
      aria-label={`Carta de ${player.name}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="player-detail-card">
        <PlayerCard
          player={player}
          clubName={club?.name ?? 'Sem clube'}
          kit={clubKit(club)}
          hidePotential={player.clubId !== ownClubId}
        />
      </div>
    </dialog>
  );
}
