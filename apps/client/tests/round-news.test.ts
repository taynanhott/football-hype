import { describe, expect, it, vi } from 'vitest';
import type { WorldState } from '@football/shared';
import { roundNews } from '../src/features/market/round-news';

vi.mock('@football/domain', () => ({ scheduledFixtures: (state: WorldState) => state.fixtures }));

function fixtureState() {
  const scores = [
    [1, 0],
    [0, 5],
    [3, 1],
    [4, 0],
    [2, 2],
  ];
  return {
    fixtures: scores.map((_, i) => ({
      id: `f${i}`,
      scheduledAt: 86400000,
      homeId: 'a',
      awayId: 'b',
    })),
    results: scores.map(([homeGoals, awayGoals], i) => ({
      fixtureId: `f${i}`,
      homeGoals,
      awayGoals,
      startedAt: 1000,
    })),
    clubs: { byId: { a: { name: 'Mandante' }, b: { name: 'Visitante' } } },
  } as unknown as WorldState;
}

describe('noticiário das rodadas', () => {
  it('destaca só os três maiores placares, incluindo goleada do visitante', () => {
    const state = fixtureState();
    const news = roundNews(state).filter((item) => item.id.startsWith('score:'));
    expect(news.map((item) => item.id)).toEqual(['score:f1', 'score:f3', 'score:f2']);
    expect(news[0]?.title).toContain('0 × 5');
    expect(news[0]?.tags).toContain('#Goleada');
    expect(news[2]?.tags).not.toContain('#Goleada');
    expect(state.results).toHaveLength(5);
  });
  it('inclui uma ou duas resenhas fictícias estáveis e sem duplicação', () => {
    const state = fixtureState();
    const news = roundNews(state);
    const jokes = news.filter((item) => item.tags.includes('#ResenhaFictícia'));
    expect(jokes.length).toBeGreaterThanOrEqual(1);
    expect(jokes.length).toBeLessThanOrEqual(2);
    expect(jokes.every((item) => item.title.includes('fictícia'))).toBe(true);
    expect(roundNews(state)).toEqual(news);
    expect(new Set(news.map((item) => item.id)).size).toBe(news.length);
  });
  it('não publica resultados nem resenhas antes de haver jogos', () => {
    expect(roundNews({ ...fixtureState(), results: [] })).toEqual([]);
  });
});
