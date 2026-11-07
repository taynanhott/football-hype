import { describe, expect, it } from 'vitest';
import type { Negotiation } from '@football/shared';
import { transferStoryKey, uniqueTransferStories } from '../src/features/market/transfer-stories';
const base = {
  id: 'first',
  playerId: 'player',
  buyerId: 'buyer',
  sellerId: 'seller',
  offeredAt: 1,
  status: 'review',
  fee: 1,
  offeredSalary: 1,
  interest: 50,
} satisfies Negotiation;
describe('notícias de transferências', () => {
  it('publica uma única notícia para propostas repetidas do mesmo negócio', () => {
    const offers = [
      base,
      ...Array.from({ length: 3 }, (_, i) => ({ ...base, id: `retry${i}`, offeredAt: i + 2 })),
    ];
    const news = uniqueTransferStories(offers);
    expect(news).toHaveLength(1);
    expect(news[0]?.id).toBe('retry2');
    expect(transferStoryKey(news[0]!)).toBe(transferStoryKey(base));
    expect(offers).toHaveLength(4);
  });
  it('atualiza o negócio concluído e preserva ofertas de outros compradores', () => {
    const done = { ...base, id: 'done', status: 'completed' as const };
    expect(uniqueTransferStories([done, base])[0]?.status).toBe('completed');
    expect(uniqueTransferStories([base, { ...base, buyerId: 'rival' }])).toHaveLength(2);
  });
});
