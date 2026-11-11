import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clubCrest, clubCrestSchema, type WorldDataset } from '@football/shared';
import { createWorld, importDataset } from '../src/index.js';

const dataset = JSON.parse(readFileSync('data/player-database.json', 'utf8')) as WorldDataset;
describe('code drawn club crests', () => {
  it('gives every database club a stable valid identity', () => {
    const clubs = Object.values(dataset.clubs.byId);
    expect(clubs.length).toBeGreaterThan(600);
    for (const club of clubs) {
      const crest = clubCrest(club);
      expect(clubCrestSchema.safeParse(crest).success).toBe(true);
      expect(clubCrest(club)).toEqual(crest);
    }
  });
  it('uses recognizable club features and preserves saved customization', () => {
    const get = (name: string) => clubCrest({ name, abbreviation: '' });
    expect(get('Flamengo')).toMatchObject({ shape: 'pointed', pattern: 'hoops', initials: 'CRF' });
    expect(get('Corinthians')).toMatchObject({ shape: 'round', symbol: 'anchor' });
    expect(get('Palmeiras')).toMatchObject({ shape: 'round', initials: 'P' });
    expect(get('Arsenal')).toMatchObject({ symbol: 'cannon', primary: '#c82032' });
    expect(
      clubCrest({
        name: 'Clube personalizado',
        abbreviation: 'CP',
        kit: { primary: '#123456', secondary: '#abcdef', pattern: 'sash' },
      }),
    ).toMatchObject({ primary: '#123456', secondary: '#abcdef', pattern: 'sash' });
    expect(get('Atlético-MG')).toEqual(get('Atletico-MG'));
    const custom = { ...get('Arsenal'), primary: '#123456' };
    expect(clubCrest({ name: 'Arsenal', abbreviation: 'ARS', crest: custom })).toBe(custom);
  });
  it('saves descriptors during league creation and dataset import', () => {
    const created = createWorld({
      id: '00000000-0000-4000-8000-000000000007',
      userId: '00000000-0000-4000-8000-000000000008',
      name: 'Escudos',
      mode: 'offline',
      now: Date.UTC(2026, 0, 11),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(Object.values(created.value.clubs.byId).every((club) => club.crest)).toBe(true);
    const imported = importDataset(created.value, dataset);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    for (const club of Object.values(imported.value.clubs.byId)) {
      expect(club.crest).toEqual(clubCrest(dataset.clubs.byId[club.id]!));
    }
    expect(JSON.parse(JSON.stringify(imported.value.clubs))).toEqual(imported.value.clubs);
  });
});
