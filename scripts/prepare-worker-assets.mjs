import { mkdir, copyFile } from 'node:fs/promises';
const target = new URL('../apps/worker/assets/', import.meta.url);
await mkdir(target, { recursive: true });
await copyFile(
  new URL('../data/player-database.json', import.meta.url),
  new URL('player-database.json', target),
);
