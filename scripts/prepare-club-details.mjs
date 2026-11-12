import { readFile, writeFile } from 'node:fs/promises';

// Run after research and review; no network access and no changes to saved careers.
const root = new URL('../', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const dataset = await read('data/player-database.json');
const research = await read('.tmp/club-research.json');
const corrections = await read('data/club-details-corrections.json');
const details = {};
const missing = [];
function plain(value = '') {
  return value
    .replace(/<ref\b[^]*?<\/ref\s*>|<ref\b[^>]*\/\s*>/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{(?:nowrap|small)\|([^{}]*)\}\}/gi, '$1')
    .replace(/\{\{ill\|([^|{}]+)[^{}]*\}\}/gi, '$1')
    .replace(/\{\{ubl\s*\|([^|{}]+)[^{}]*\}\}/gi, '$1')
    .replace(/\((?:interim|caretaker)[^)]*\)/gi, '')
    .replace(/;+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
for (const club of Object.values(dataset.clubs.byId)) {
  const item = research[club.name];
  const correction = corrections[club.name];
  let coachName = plain(
    correction?.coachName ||
      item?.fields?.head_coach ||
      item?.fields?.headcoach ||
      item?.fields?.coach ||
      item?.coachName,
  );
  const vacant = /^(vacant|tbd|tba|none|to be (?:announced|determined))$/i.test(coachName);
  if (vacant) coachName = 'Sem técnico';
  const stadiumName = plain(correction?.stadiumName ?? item?.stadiumName)
    .split(';')[0]
    .replace(/[, ]+$/, '')
    .trim();
  const valid = (value) =>
    value &&
    value.length <= 100 &&
    !/[{}<>]|https?:|undefined/.test(value) &&
    !value.includes('[') &&
    !value.includes(']');
  const entry = {
    ...(valid(coachName) ? { coachName, coachSource: correction?.coachSource ?? item.source } : {}),
    ...(valid(stadiumName)
      ? { stadiumName, stadiumSource: correction?.stadiumSource ?? item.source }
      : {}),
    researchedOn: '2026-11-11',
    ...(vacant || correction?.coachStatus === 'vacant' ? { coachStatus: 'vacant' } : {}),
    ...(item?.revisionAt ? { sourceUpdatedAt: item.revisionAt } : {}),
  };
  details[club.name] = entry;
  if (!entry.coachName || !entry.stadiumName)
    missing.push({ name: club.name, coachName, stadiumName, title: item?.title });
}
await writeFile(new URL('data/club-details.json', root), JSON.stringify(details, null, 2) + '\n');
await writeFile(
  new URL('.tmp/club-details-missing.json', root),
  JSON.stringify(missing, null, 2) + '\n',
);
console.log(
  JSON.stringify({
    clubs: Object.keys(details).length,
    coaches: Object.values(details).filter((x) => x.coachName).length,
    stadiums: Object.values(details).filter((x) => x.stadiumName).length,
    missing,
  }),
);
