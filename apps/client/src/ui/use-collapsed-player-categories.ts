import { useState } from 'react';
import { useGameStore } from '../store/game-store';

const categories = new Set([
  'Goleiros',
  'Zagueiros',
  'Laterais',
  'Volantes',
  'Meias',
  'Pontas',
  'Atacantes',
  'Outros',
]);

export function useCollapsedPlayerCategories(scope: 'squad' | 'club') {
  const userId = useGameStore((state) => state.userId);
  const key = `football.player-categories.${scope}.${userId ?? 'guest'}`;
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    if (scope === 'squad') return [];
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(saved)
        ? saved.filter(
            (entry): entry is string => typeof entry === 'string' && categories.has(entry),
          )
        : [];
    } catch {
      return [];
    }
  });
  function toggle(category: string) {
    if (!categories.has(category)) return;
    const next = collapsed.includes(category)
      ? collapsed.filter((item) => item !== category)
      : [...collapsed, category];
    setCollapsed(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Keep the selection in memory if browser storage is unavailable. */
    }
  }
  return [collapsed, toggle] as const;
}
