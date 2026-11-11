import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { clubCrest } from '../packages/shared/dist/config/club-crests.js';

const root = new URL('../', import.meta.url);
const dataset = JSON.parse(await readFile(new URL('data/player-database.json', root), 'utf8'));
const catalog = {
  source: dataset.source,
  imported: true,
  clubs: Object.values(dataset.clubs.byId)
    .filter((club) => club.country === 'BR')
    .map((club) => ({
      id: club.id,
      name: club.name,
      division: club.division,
      abbreviation: club.abbreviation,
      crest: clubCrest(club),
    })),
};
if (!catalog.clubs.length) throw new Error('O catálogo brasileiro está vazio');
const directory = new URL('apps/client/src/data/', root);
await mkdir(directory, { recursive: true });
await writeFile(new URL('club-catalog.json', directory), JSON.stringify(catalog, null, 2) + '\n');
