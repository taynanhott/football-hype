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
      className="modal player-detail-modal"
      aria-labelledby="player-detail-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button className="close-modal" aria-label="Fechar detalhes do jogador" onClick={onClose}>
        ×
      </button>
      <h2 id="player-detail-title">{player.name}</h2>
      <p>
        {club ? (
          <a href={'#/trophies?club=' + club.id} onClick={onClose}>
            Ver clube: {club.name} ↗
          </a>
        ) : (
          'Jogador sem clube'
        )}
      </p>
      <div className="player-detail-card">
        <PlayerCard
          player={player}
          clubName={club?.name ?? 'Sem clube'}
          kit={clubKit(club)}
          hidePotential={player.clubId !== ownClubId}
          initiallyFlipped
        />
      </div>
      <p>Clique na carta para alternar entre o retrato e os atributos.</p>
    </dialog>
  );
}
