import { competitionClubKey, FIXED_CUP_ENTRANTS, type ClubSnapshot } from '@football/shared';
import { hashSeed, mulberry32 } from '../simulation/random.js';
export function fixedCupParticipants(clubs: readonly ClubSnapshot[], id: string) {
  const names = FIXED_CUP_ENTRANTS[id];
  if (!names) return undefined;
  const participants: string[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const club = clubs.find((c) => competitionClubKey(c.name) === competitionClubKey(name));
    if (club) participants.push(club.id);
    else missing.push(name);
  }
  return { participants, missing };
}
export function shuffleCupParticipants(ids: readonly string[], seed: number, id: string) {
  const random = mulberry32(hashSeed(seed, id));
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}
