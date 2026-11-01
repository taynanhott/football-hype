import { describe, expect, it } from 'vitest';
import {
  FORMATIONS,
  FORMATION_LINKS,
  formationSchema,
  playStyleSchema,
  type PlayerSnapshot,
} from '@football/shared';
import { positionFactor, tacticalBonus } from '../src/index';

describe('catálogo de formações de referência', () => {
  it('expõe somente os quinze esquemas solicitados e migra o antigo', () => {
    expect(formationSchema.options).toEqual([
      '4-4-2',
      '4-3-3',
      '4-2-3-1',
      '4-1-4-1',
      '4-4-1-1',
      '4-3-1-2',
      '4-2-2-2',
      '4-3-3-offensive',
      '4-2-4',
      '4-5-1',
      '3-5-2',
      '3-4-3',
      '3-2-4-1',
      '5-3-2',
      '5-4-1',
    ]);
    expect(formationSchema.parse('3-4-1-2')).toBe('3-5-2');
  });
  it('mantém onze lugares distintos e uma rede conectada sem linhas duplicadas', () => {
    for (const name of formationSchema.options) {
      const slots = FORMATIONS[name],
        links = FORMATION_LINKS[name];
      expect(slots).toHaveLength(11);
      expect(slots[0]?.position).toBe('GK');
      expect(new Set(slots.map((s) => `${s.x},${s.y}`)).size).toBe(11);
      expect(new Set(links.map(([a, b]) => [a, b].sort((x, y) => x - y).join('-'))).size).toBe(
        links.length,
      );
      const reached = new Set([0]);
      for (let pass = 0; pass < 11; pass++)
        for (const [a, b] of links) {
          expect(a).not.toBe(b);
          expect(slots[a]).toBeDefined();
          expect(slots[b]).toBeDefined();
          if (reached.has(a) || reached.has(b)) {
            reached.add(a);
            reached.add(b);
          }
        }
      expect(reached.size).toBe(11);
    }
  });
  it('distingue alas, segundo atacante e os dois esquemas 4-3-3', () => {
    expect(FORMATIONS['4-4-1-1'].some((s) => s.position === 'SS')).toBe(true);
    expect(FORMATIONS['5-4-1'].filter((s) => ['LWB', 'RWB'].includes(s.position))).toHaveLength(2);
    expect(FORMATIONS['4-3-3']).not.toEqual(FORMATIONS['4-3-3-offensive']);
    expect(positionFactor('LB', 'LWB')).toBeGreaterThan(positionFactor('CB', 'LWB'));
    expect(positionFactor('ST', 'SS')).toBeGreaterThan(positionFactor('CB', 'SS'));
  });
  it('recalcula todas as combinações sem ultrapassar o limite de bônus', () => {
    const players = ['CB', 'CM', 'DM', 'AM', 'LW', 'RW', 'ST', 'LWB', 'RWB', 'SS'].map(
      (position) => ({ position, overall: 85, fitness: 100 }),
    ) as PlayerSnapshot[];
    for (const a of formationSchema.options)
      for (const b of formationSchema.options)
        for (const style of playStyleSchema.options)
          for (const opponent of playStyleSchema.options) {
            const bonus = tacticalBonus(style, a, opponent, b, players);
            expect(Number.isFinite(bonus)).toBe(true);
            expect(Math.abs(bonus)).toBeLessThanOrEqual(3);
          }
  });
});
