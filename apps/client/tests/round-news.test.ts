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
  it('inclui duas a quatro resenhas da rodada estáveis e sem duplicação', () => {
    const state = fixtureState();
    const news = roundNews(state);
    const jokes = news.filter((item) => item.tags.includes('#ResenhaDaRodada'));
    expect(jokes.length).toBeGreaterThanOrEqual(2);
    expect(jokes.length).toBeLessThanOrEqual(4);
    expect(jokes.every((item) => item.title === 'Resenha do Vestiário')).toBe(true);
    expect(JSON.stringify(news)).not.toContain('fictícia');
    expect(roundNews(state)).toEqual(news);
    expect(new Set(news.map((item) => item.id)).size).toBe(news.length);
  });
  it('ordena pela data dos jogos, mesmo quando o processamento ocorre fora de ordem', () => {
    const state = fixtureState();
    const older = { ...state.fixtures[0]!, id: 'older', scheduledAt: 0 };
    const news = roundNews({
      ...state,
      fixtures: [...state.fixtures, older],
      results: [
        ...state.results,
        { ...state.results[0]!, fixtureId: 'older', startedAt: 999999999 },
      ],
    });
    expect(news.map((item) => item.at)).toEqual(news.map((item) => item.at).sort((a, b) => b - a));
    expect(news.findIndex((item) => item.id === 'score:older')).toBeGreaterThan(
      news.findIndex((item) => item.id === 'score:f1'),
    );
  });
  it('alterna textos de cada comentarista entre rodadas próximas', () => {
    const base = fixtureState();
    const fixtures = Array.from({ length: 24 }, (_, i) => ({
      ...base.fixtures[0]!,
      id: 'day' + i,
      scheduledAt: (i + 1) * 86400000,
    }));
    const results = fixtures.map((fixture) => ({ ...base.results[0]!, fixtureId: fixture.id }));
    const news = roundNews({ ...base, fixtures, results }).filter((item) =>
      item.tags.includes('#ResenhaDaRodada'),
    );
    for (const reporter of ['Cazé', 'Bruno Formiga', 'Craque Neto']) {
      const texts = news.filter((item) => item.reporterName === reporter).map((item) => item.body);
      expect(texts.length).toBeGreaterThan(1);
      for (let i = 1; i < texts.length; i++) expect(texts[i]).not.toBe(texts[i - 1]);
    }
  });
  it('não publica resultados nem resenhas antes de haver jogos', () => {
    expect(roundNews({ ...fixtureState(), results: [] })).toEqual([]);
  });
});
