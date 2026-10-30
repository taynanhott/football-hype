import { useState } from 'react';
import { useGameStore } from '../store/game-store';

export function usePlayerPresentation() {
  const userId = useGameStore((state) => state.userId);
  const key = 'football.player-presentation.' + (userId ?? 'guest');
  const [value, setValue] = useState<'cards' | 'list'>(() => {
    try {
      return localStorage.getItem(key) === 'list' ? 'list' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const update = (next: string) => {
    if (next !== 'cards' && next !== 'list') return;
    setValue(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* Retain the preference for this session. */
    }
  };
  return [value, update] as const;
}
