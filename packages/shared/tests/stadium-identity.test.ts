import { describe, it, expect } from 'vitest';
import { resolvedStadiumSkin } from '../src/config/stadium-identity';
import type { StadiumSnapshot } from '../src/types/snapshots';
function stadium(name: string, level: number, skin?: StadiumSnapshot['skin']): StadiumSnapshot {
  return {
    id: 'test',
    clubId: 'club',
    name,
    skin,
    pitchLevel: 1,
    surroundingsLevel: 1,
    sectors: ([{ id: 'north' }, { id: 'south' }, { id: 'east' }, { id: 'west' }] as const).map(
      (s) => ({ ...s, level, capacity: 100 }),
    ),
    commerce: { foodLevel: 1, shirtsLevel: 1, hospitalityLevel: 1 },
  };
}
describe('stadium skin unlock', () => {
  it('keeps unlinked clubs generic below level four, including old saved skins', () =>
    expect(resolvedStadiumSkin(stadium('Estádio Mirassol', 3, 'morumbi'))).toBeUndefined());
  it('keeps linked architecture at every level', () => {
    for (const level of [1, 2, 3, 4, 5])
      expect(resolvedStadiumSkin(stadium('Estádio Flamengo', level))).toBe('maracana');
  });
  it('allows a chosen model only from level four', () => {
    expect(resolvedStadiumSkin(stadium('Estádio Flamengo', 3, 'morumbi'))).toBe('maracana');
    expect(resolvedStadiumSkin(stadium('Estádio Flamengo', 4, 'morumbi'))).toBe('morumbi');
    expect(resolvedStadiumSkin(stadium('Estádio Mirassol', 4, 'morumbi'))).toBe('morumbi');
  });
});

describe('modelos 3D após atualização dos nomes dos estádios', () => {
  it.each([
    ['Maracanã', 'maracana'],
    ['Arena MRV', 'arena-mrv'],
    ['Mineirão', 'mineirao'],
    ['Neo Química Arena', 'neo-quimica'],
    ['São Januário', 'sao-januario'],
    ['Beira-Rio', 'beira-rio'],
    ['Arena do Grêmio', 'arena-gremio'],
    ['Estádio Olímpico Nilton Santos', 'nilton-santos'],
    ['Nubank Parque', 'palmeiras-park'],
    ['Allianz Parque', 'palmeiras-park'],
    ['MorumBIS', 'morumbi'],
    ['Vila Belmiro', 'vila-belmiro'],
    ['Arena da Baixada', 'arena-baixada'],
  ])('%s mantém o modelo %s em todos os níveis', (name, skin) => {
    for (const level of [1, 2, 3, 4, 5])
      expect(resolvedStadiumSkin(stadium(name, level))).toBe(skin);
    expect(resolvedStadiumSkin(stadium(name, 3, 'morumbi'))).toBe(skin);
    expect(resolvedStadiumSkin(stadium(name, 4, 'morumbi'))).toBe('morumbi');
  });
});
