import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';
import { convertFootballData, footballTeamsSchema } from './football-data-import.js';

const token = process.env.FOOTBALL_DATA_TOKEN?.trim();
if (!token) throw new Error('Configure FOOTBALL_DATA_TOKEN em apps/server/.env');
async function query(path: string): Promise<unknown> {
  const response = await fetch(`https://api.football-data.org/v4/${path}`, {
    headers: { 'X-Auth-Token': token ?? '' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      `Football-data respondeu HTTP ${response.status}. Confira o token, a cobertura e a cota.`,
    );
  return response.json();
}
const input = footballTeamsSchema.parse(await query('competitions/BSA/teams'));
const occurrences = new Map<number, number>();
for (const team of input.teams)
  for (const person of team.squad)
    occurrences.set(person.id, (occurrences.get(person.id) ?? 0) + 1);
const currentTeams = new Map<number, number>();
for (const [id, count] of occurrences)
  if (count > 1) {
    const person = z
      .object({ currentTeam: z.object({ id: z.number().int() }) })
      .parse(await query(`persons/${id}`));
    currentTeams.set(id, person.currentTeam.id);
  }
const { dataset, excluded } = convertFootballData(input, Date.now(), currentTeams);
const output = resolve(process.argv[2] ?? '.local/datasets/football-data-BSA.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(`${output}.tmp`, JSON.stringify(dataset));
await rename(`${output}.tmp`, output);
await writeFile(
  `${output}.report.json`,
  JSON.stringify(
    {
      source: dataset.source,
      excluded,
      clubCount: dataset.clubs.ids.length,
      playerCount: dataset.players.ids.length,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    { output, clubs: dataset.clubs.ids.length, players: dataset.players.ids.length, excluded },
    null,
    2,
  ),
);
