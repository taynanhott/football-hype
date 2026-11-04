import { useGameStore } from '../../store/game-store';
import { scoutingReport } from './scouting-report';
import type { PlayerSnapshot } from '@football/shared';

export function useScoutingReport() {
  const world = useGameStore((s) => s.snapshot?.state);
  const userId = useGameStore((s) => s.userId);
  const ownClubId = world?.participants.find((p) => p.userId === userId)?.clubId;
  const ownClub = world?.clubs.byId[ownClubId ?? ''];
  const level = world?.centers.byId[ownClub?.trainingCenterId ?? '']?.levels.scouting ?? 1;
  return (player: PlayerSnapshot) =>
    scoutingReport(
      player,
      ownClubId,
      level,
      Boolean(ownClubId && world?.management?.loans?.[player.id]?.ownerId === ownClubId),
    );
}
