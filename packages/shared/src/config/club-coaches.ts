import coaches from './club-coaches.json' with { type: 'json' };

/** Bundled presentation fallback for careers created before real coach names were imported. */
export function researchedClubCoachName(clubName: string): string | undefined {
  return (coaches as Record<string, string>)[clubName];
}
