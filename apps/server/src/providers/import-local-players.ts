import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { convertLocalPlayers } from './local-player-import.js';
const root = resolve('../..');
const extras = await readFile(resolve(root, 'data/source-extras.json'), 'utf8')
  .then((text) => JSON.parse(text))
  .catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
const { dataset, report } = convertLocalPlayers(
  JSON.parse(await readFile(resolve(root, 'data/player-source.json'), 'utf8')),
  JSON.parse(await readFile(resolve(root, 'data/clubs-source.json'), 'utf8')),
  JSON.parse(await readFile(resolve(root, 'data/player-exclusions.json'), 'utf8')),
  extras,
);
await writeFile(resolve(root, 'data/player-database.json'), JSON.stringify(dataset));
await mkdir(resolve(root, 'apps/worker/assets'), { recursive: true });
await copyFile(
  resolve(root, 'data/player-database.json'),
  resolve(root, 'apps/worker/assets/player-database.json'),
);
await writeFile(resolve(root, 'data/player-import-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
