import { useState } from 'react';
import { useGameStore } from '../store/game-store';

const positions = new Set([
  'ALL',
  'GK',
  'CB',
  'RB',
  'LB',
  'RWB',
  'LWB',
  'DM',
  'CM',
  'RM',
  'LM',
  'AM',
  'RW',
  'LW',
  'SS',
  'ST',
]);

export function usePlayerPositionFilter(scope: 'squad' | 'club') {
  const userId = useGameStore((state) => state.userId);
  const key = `football.player-position.${scope}.${userId ?? 'guest'}`;
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved && positions.has(saved) ? saved : 'ALL';
    } catch {
      return 'ALL';
    }
  });
  const update = (next: string) => {
    if (!positions.has(next)) return;
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* Keep the filter available when browser storage is unavailable. */
    }
  };
  return [value, update] as const;
}
