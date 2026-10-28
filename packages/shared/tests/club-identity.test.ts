import { describe, it, expect } from 'vitest';
import { clubKit, kitFromClubColors, matchKits } from '../src/config/club-identity.js';
describe('club uniforms', () => {
  it('uses club identity for both sides and preserves custom kits', () => {
    const club = { name: 'Flamengo' };
    expect(matchKits(club, { name: 'Palmeiras' }).home).toEqual(
      matchKits({ name: 'Palmeiras' }, club).away,
    );
    expect(clubKit({ name: 'São Paulo' }).tertiary).toBeDefined();
    const custom = { primary: '#123456', secondary: '#fedcba', pattern: 'sash' as const };
    expect(clubKit({ ...club, kit: custom })).toEqual(custom);
    expect(clubKit({ name: 'Aurora FC' })).toEqual(clubKit({ name: 'Aurora FC' }));
  });
  it('keeps the visitor within its club colors when uniforms clash', () => {
    const visitor = clubKit({ name: 'Santos' }),
      kits = matchKits({ name: 'Corinthians' }, { name: 'Santos' });
    expect(kits.away.primary).toBe(visitor.secondary);
    expect(kits.away.secondary).toBe(visitor.primary);
  });
  it('imports provided colors instead of inheriting a template club palette', () => {
    expect(kitFromClubColors('Example', 'Blue / White / Red')).toMatchObject({
      primary: '#2355ad',
      secondary: '#f5f3e9',
      tertiary: '#c72837',
    });
    expect(kitFromClubColors('Palmeiras', null)).toEqual(clubKit({ name: 'Palmeiras' }));
  });
});
