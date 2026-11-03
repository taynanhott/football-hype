import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { playerSchema, type PlayerSnapshot } from '@football/shared';
import { SearchTrie } from '@football/domain';
import {
  UNLIMITED_MARKET_PRICE,
  marketPriceCeiling,
  matchesMarketRanges,
} from '../src/features/market/market-filters';
const raw = JSON.parse(
  readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
) as { players: { byId: Record<string, unknown> } };
const stars = Object.values(raw.players.byId).flatMap((value) => {
  const p = playerSchema.parse(value);
  return /Lamine Yamal|Kylian Mbappé/.test(p.name) ? [p] : [];
});

describe('pesquisa de estrelas no mercado com a base real', () => {
  it.each(['Yamal', 'Mbappe'])(
    'a busca por %s passa pelos filtros padrão com os valores mv da fonte',
    (query) => {
      const trie = new SearchTrie();
      for (const player of stars) trie.insert(player.name, player.id);
      const ids = trie.search(query);
      const results = stars.filter(
        (p) =>
          ids.includes(p.id) &&
          matchesMarketRanges(p, [1, 99], [16, 45], [0, UNLIMITED_MARKET_PRICE]),
      );
      expect(results).toHaveLength(1);
      expect(results[0]!.marketValue.cents).toBeGreaterThan(0);
    },
  );
  it('limita preço só quando escolhido e permite restaurar a busca sem teto', () => {
    const yamal = stars.find((p) => p.name === 'Lamine Yamal')!;
    expect(
      matchesMarketRanges(yamal, [1, 99], [16, 45], [0, yamal.marketValue.cents / 100 - 1]),
    ).toBe(false);
    expect(matchesMarketRanges(yamal, [1, 99], [16, 45], [0, UNLIMITED_MARKET_PRICE])).toBe(true);
    expect(marketPriceCeiling(stars)).toBeGreaterThanOrEqual(yamal.marketValue.cents / 100);
    const evolved: PlayerSnapshot = {
      ...yamal,
      marketValue: {
        ...yamal.marketValue,
        cents: Math.max(yamal.marketValue.cents * 2, 600000000 * 100),
      },
    };
    expect(matchesMarketRanges(evolved, [1, 99], [16, 45], [0, UNLIMITED_MARKET_PRICE])).toBe(true);
    expect(marketPriceCeiling([evolved])).toBeGreaterThan(marketPriceCeiling(stars));
  });
});
