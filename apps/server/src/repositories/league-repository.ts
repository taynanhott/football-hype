import type { GameEvent, WorldState } from '@football/shared';
export type SavedLeague = Readonly<{ state: WorldState; events: readonly GameEvent[] }>;
export interface LeagueRepository {
  load(id: string): Promise<SavedLeague | undefined>;
  create(state: WorldState): Promise<void>;
  append(id: string, expectedRevision: number, state: WorldState, event: GameEvent): Promise<void>;
  forUser(userId: string): Promise<readonly WorldState[]>;
  active(): Promise<readonly string[]>;
  due(now: number): Promise<readonly string[]>;
}
