import type { GameEvent, WorldState } from '@football/shared';
export type SavedLeague = Readonly<{ state: WorldState; events: readonly GameEvent[] }>;
export type LeagueSummary = Pick<
  WorldState,
  'id' | 'name' | 'mode' | 'season' | 'round' | 'administratorId'
>;
export type DrawReservation = { leagueId: string; clubId: string; division: string };
export interface LeagueRepository {
  reserveDraw?(
    userId: string,
    mode: 'offline' | 'multiplayer',
    draw: DrawReservation,
  ): Promise<DrawReservation>;
  getDraw?(userId: string, mode: 'offline' | 'multiplayer'): Promise<DrawReservation | undefined>;
  remove?(id: string, userId: string, now: number): Promise<void>;
  summariesForUser?(userId: string): Promise<readonly LeagueSummary[]>;
  load(id: string, options?: { eventPatches?: boolean }): Promise<SavedLeague | undefined>;
  create(state: WorldState): Promise<void>;
  append(id: string, expectedRevision: number, state: WorldState, event: GameEvent): Promise<void>;
  forUser(userId: string): Promise<readonly WorldState[]>;
  active(): Promise<readonly string[]>;
  due(now: number): Promise<readonly string[]>;
}
