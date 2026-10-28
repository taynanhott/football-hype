import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { convertLocalPlayers } from './local-player-import.js';
const root = resolve('../..');
const { dataset, report } = convertLocalPlayers(
  JSON.parse(await readFile(resolve(root, 'data/player-source.json'), 'utf8')),
  JSON.parse(await readFile(resolve(root, 'data/clubs-source.json'), 'utf8')),
  JSON.parse(await readFile(resolve(root, 'data/player-exclusions.json'), 'utf8')),
);
await writeFile(resolve(root, 'data/player-database.json'), JSON.stringify(dataset));
await writeFile(resolve(root, 'data/player-import-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
