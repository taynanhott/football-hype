import { readSavedLeague } from './read-saved-league.mts';
import { writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { worldStateSchema } from '../packages/shared/src/index.js';
import { resetSeasonCompetitions, recordEvent, applyEvent } from '../packages/domain/src/index.js';

const leagueId = process.argv[2];
if (!leagueId || !/^[a-f0-9-]{36}$/.test(leagueId))
  throw new Error('Informe o ID exato da carreira autorizada.');
const root = fileURLToPath(new URL('..', import.meta.url));
const directory = resolve(root, 'apps/server/.local/real-leagues');
const file = join(directory, `${leagueId}.json.gz`);
if (relative(directory, file).startsWith('..')) throw new Error('Caminho inválido');
const saved = await readSavedLeague(file);
const previous = worldStateSchema.parse(saved.state);
if (previous.deletedAt) throw new Error('Carreira arquivada; não foi alterada.');
const now = Date.now();
const next = resetSeasonCompetitions(previous, now);
const event = recordEvent(previous, next, {
  id: randomUUID(),
  occurredAt: now,
  actorId: previous.administratorId,
  type: 'season.started',
  message: `Temporada ${previous.season} reiniciada: regras personalizadas da imagem, acessos regionais dentro de quatro vagas e novos torneios continentais.`,
  amount: 0,
});
if (!event.ok) throw new Error(event.error.message);
const applied = applyEvent(previous, event.value);
if (!applied.ok) throw new Error(applied.error.message);
const backup = join(directory, '.backups', `${leagueId}-${now}.json.gz.bak`);
await mkdir(dirname(backup), { recursive: true });
await writeFile(backup, gzipSync(JSON.stringify(saved)));
const updated = gzipSync(
  JSON.stringify({ ...saved, state: applied.value, events: [...saved.events, event.value] }),
);
await writeFile(`${file}.regularized.tmp`, updated);
await rename(`${file}.regularized.tmp`, file);
console.log(
  JSON.stringify(
    {
      backup,
      league: previous.name,
      season: applied.value.season,
      round: applied.value.round,
      club: applied.value.participants.map((p) => applied.value.clubs.byId[p.clubId]?.name),
      divisions: Object.fromEntries(
        ['A', 'B', 'C', 'D'].map((division) => [
          division,
          Object.values(applied.value.clubs.byId).filter(
            (club) => club.country === 'BR' && club.division === division,
          ).length,
        ]),
      ),
      fixtures: Object.fromEntries(
        ['serie-c', 'serie-d', 'copa-norte', 'copa-nordeste', 'copa-verde', 'copa-sul-sudeste'].map(
          (id) => [id, applied.value.fixtures.filter((f) => f.competitionId === id).length],
        ),
      ),
      notes: applied.value.competitionNotes,
    },
    null,
    2,
  ),
);
