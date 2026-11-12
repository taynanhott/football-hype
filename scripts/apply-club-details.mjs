import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';

// Explicit maintenance operation. Patch names only, preserving every other dataset field.
const root = new URL('../', import.meta.url);
const details = JSON.parse(await readFile(new URL('data/club-details.json', root), 'utf8'));
await writeFile(
  new URL('packages/shared/src/config/club-coaches.json', root),
  JSON.stringify(
    Object.fromEntries(
      Object.entries(details)
        .filter(([, entry]) => entry.coachName)
        .map(([name, entry]) => [name, entry.coachName]),
    ),
    null,
    2,
  ) + '\n',
);
const file = new URL('data/player-database.json', root);
const dataset = JSON.parse(await readFile(file, 'utf8'));
const backup = new URL(`data/.backups/club-details-${Date.now()}/`, root);
await mkdir(backup, { recursive: true });
await copyFile(file, new URL('player-database.json', backup));
let coaches = 0,
  stadiums = 0;
for (const club of Object.values(dataset.clubs.byId)) {
  const entry = details[club.name];
  if (!entry) continue;
  if (entry.coachName) {
    club.coachName = entry.coachName;
    coaches++;
  }
  const stadium = dataset.stadiums.byId[club.stadiumId];
  if (entry.stadiumName && stadium?.clubId === club.id) {
    stadium.name = entry.stadiumName;
    stadiums++;
  }
}
await writeFile(file, JSON.stringify(dataset));
await mkdir(new URL('apps/worker/assets/', root), { recursive: true });
await copyFile(file, new URL('apps/worker/assets/player-database.json', root));
console.log(JSON.stringify({ clubs: dataset.clubs.ids.length, coaches, stadiums }));
