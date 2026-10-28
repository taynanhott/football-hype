import { describe, it, expect } from 'vitest';
import {
  illustratedAppearance,
  importedAppearance,
  portraitAppearance,
} from '../src/config/player-appearance.js';
import { appearanceSchema } from '../src/schemas/player.js';
describe('illustrated player portraits', () => {
  it('gives stable varied illustrations without using name or nationality', () => {
    const ids = Array.from(
      { length: 500 },
      (_, i) => '00000020-0000-4000-8000-' + i.toString(16).padStart(12, '0'),
    );
    const portraits = ids.map(illustratedAppearance);
    expect(new Set(portraits.map((p) => p.skinTone)).size).toBeGreaterThan(5);
    expect(new Set(portraits.map((p) => p.hairStyle)).size).toBe(5);
    expect(new Set(portraits.map((p) => p.hairColor)).size).toBeGreaterThan(4);
    expect(portraits.every((p) => appearanceSchema.safeParse(p).success)).toBe(true);
    expect(illustratedAppearance(ids[12]!)).toEqual(portraits[12]);
  });
  it('corrects old cloned local portraits without changing custom appearances from other sources', () => {
    const appearance = {
      skinTone: '#533422',
      hairColor: '#241d1a',
      hairStyle: 'short',
      beardStyle: 'none',
    } as const;
    const id = '00000020-0000-4000-8000-0000000533d6';
    expect(portraitAppearance({ id, appearance })).toEqual(importedAppearance(id));
    expect(portraitAppearance({ id: '00000001-0000-4000-8000-000000000001', appearance })).toEqual(
      appearance,
    );
  });
});

it('uses measured source colors, baldness and individual overrides', () => {
  const id = (n: number) => '00000020-0000-4000-8000-' + n.toString(16).padStart(12, '0');
  expect(importedAppearance(id(348263))).toMatchObject({
    skinTone: '#E3AF84',
    hairColor: '#D9BE7E',
    hairStyle: 'short',
    beardStyle: 'none',
  });
  expect(importedAppearance(id(131789))).toMatchObject({
    skinTone: '#C98D60',
    hairColor: '#2A1A0F',
    hairStyle: 'curly',
    beardStyle: 'stubble',
  });
  expect(importedAppearance(id(403315))).toMatchObject({
    skinTone: '#E3AF84',
    hairStyle: 'curly',
    beardStyle: 'full',
  });
  expect(importedAppearance(id(0))).toEqual(illustratedAppearance(id(0)));
});
