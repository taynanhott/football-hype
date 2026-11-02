import { describe, expect, it } from 'vitest';
import { FORMATIONS, type Formation } from '@football/shared';
import { layoutLineupCards } from '../src/features/players/lineup-card-layout';

describe('cartas dentro do campo sem sobreposição', () => {
  it('mantém as cartas dentro das linhas laterais no desktop', () => {
    for (const width of [580, 900, 1150]) {
      for (const formation of Object.keys(FORMATIONS) as Formation[]) {
        const cards = layoutLineupCards(FORMATIONS[formation], width, 620, 76, 94, formation);
        for (const card of cards) {
          const x = (card.x * width) / 100;
          expect(x - 38).toBeGreaterThan(width * 0.03);
          expect(x + 38).toBeLessThan(width * 0.97);
        }
      }
    }
  });
  it('preserva a linha de três meias atrás do centroavante no 4-2-3-1', () => {
    for (const width of [260, 288, 330, 380]) {
      const cards = layoutLineupCards(FORMATIONS['4-2-3-1'], width, 480, 61.2, 82.8, '4-2-3-1');
      const striker = cards.find((card) => card.position === 'ST')!;
      const midfield = cards.filter((card) => ['LW', 'AM', 'RW'].includes(card.position));
      for (const card of midfield) expect(card.y - striker.y).toBeGreaterThan(15);
      expect(
        Math.max(...midfield.map((card) => card.y)) - Math.min(...midfield.map((card) => card.y)),
      ).toBeLessThan(1);
    }
  });
  it('mantém o centroavante do 3-4-3 centralizado no ataque', () => {
    for (const width of [288, 330, 380]) {
      const cards = layoutLineupCards(FORMATIONS['3-4-3'], width, 480, 61.2, 82.8, '3-4-3');
      const striker = cards.find((card) => card.position === 'ST')!;
      expect(striker.x).toBeCloseTo(50);
      expect(striker.y).toBeLessThan(25);
    }
  });
  for (const width of [260, 288, 330, 380, 580]) {
    for (const [formation, entries] of Object.entries(FORMATIONS)) {
      it(`${formation} em campo de ${width}px`, () => {
        const height = width <= 380 ? 480 : 620;
        const cardWidth = width <= 380 ? 61.2 : 76;
        const cardHeight = width <= 380 ? 82.8 : 94;
        const cards = layoutLineupCards(
          entries,
          width,
          height,
          cardWidth,
          cardHeight,
          formation as Formation,
        );
        for (const [index, card] of cards.entries()) {
          const x = (card.x / 100) * width;
          const y = (card.y / 100) * height;
          expect(x - cardWidth / 2).toBeGreaterThanOrEqual(4.9);
          expect(x + cardWidth / 2).toBeLessThanOrEqual(width - 4.9);
          expect(y - cardHeight / 2).toBeGreaterThanOrEqual(4.9);
          expect(y + cardHeight / 2).toBeLessThanOrEqual(height - 4.9);
          for (const [offset, other] of cards.slice(index + 1).entries()) {
            const original = entries[index]!;
            const originalOther = entries[index + offset + 1]!;
            if (original.y < originalOther.y) expect(card.y).toBeLessThan(other.y);
            if (original.y > originalOther.y) expect(card.y).toBeGreaterThan(other.y);
            if (original.y === originalOther.y) expect(card.y).toBeCloseTo(other.y);
            if (original.x < originalOther.x) expect(card.x).toBeLessThanOrEqual(other.x);
            if (original.x === originalOther.x) expect(card.x).toBeCloseTo(other.x);
            const dx = Math.abs(x - (other.x / 100) * width);
            const dy = Math.abs(y - (other.y / 100) * height);
            expect(dx >= cardWidth - 0.1 || dy >= cardHeight + 9.9).toBe(true);
          }
        }
      });
    }
  }
});
