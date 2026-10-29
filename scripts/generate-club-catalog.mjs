import { readFile, mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dataset = JSON.parse(await readFile(new URL('data/player-database.json', root), 'utf8'));
const catalog = {
  source: dataset.source,
  imported: true,
  clubs: Object.values(dataset.clubs.byId)
    .filter((club) => club.country === 'BR')
    .map(({ id, name, division, crestUrl }) => ({
      id,
      name,
      division,
      ...(crestUrl ? { crestUrl } : {}),
    })),
};
if (!catalog.clubs.length) throw new Error('O catálogo brasileiro está vazio');
const directory = new URL('apps/client/src/data/', root);
await mkdir(directory, { recursive: true });
await writeFile(new URL('club-catalog.json', directory), JSON.stringify(catalog, null, 2) + '\n');
