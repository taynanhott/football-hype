import { readSavedLeague } from './read-saved-league.mts';
import { writeFile, readdir, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { worldStateSchema } from '../packages/shared/src/index.js';
import { pendingFixtures, recordEvent, applyEvent } from '../packages/domain/src/index.js';
const directory = fileURLToPath(new URL('../apps/server/.local/real-leagues/', import.meta.url));
for (const filename of await readdir(directory)) {
  if (!filename.endsWith('.json.gz')) continue;
  const file = join(directory, filename);
  const saved = await readSavedLeague(file);
  const previous = worldStateSchema.parse(saved.state);
  if (previous.deletedAt) continue;
  const fixtures = previous.fixtures.filter((f) => f.competitionId !== 'conferencia');
  const cups = previous.cups.filter((n) => n.competitionId !== 'conferencia');
  const results = previous.results.filter((r) => r.competitionId !== 'conferencia');
  if (
    fixtures.length === previous.fixtures.length &&
    cups.length === previous.cups.length &&
    results.length === previous.results.length &&
    !previous.competitionNotes?.conferencia
  )
    continue;
  const removedResults = new Set(
    previous.results.filter((r) => r.competitionId === 'conferencia').map((r) => r.fixtureId),
  );
  const competitionNotes = { ...previous.competitionNotes };
  delete competitionNotes.conferencia;
  let next = {
    ...previous,
    fixtures,
    cups,
    results,
    competitionNotes,
    ratingHistory: previous.ratingHistory.filter((r) => !removedResults.has(r.fixtureId)),
    trophies: previous.trophies.filter((t) => t.competitionId !== 'conferencia'),
  };
  const pending = pendingFixtures(next);
  next = {
    ...next,
    nextScheduledAt: pending[0]?.scheduledAt ?? previous.lastProcessedAt,
    status: pending.length ? 'active' : 'finished',
  };
  const now = Date.now();
  const event = recordEvent(previous, next, {
    id: randomUUID(),
    occurredAt: now,
    actorId: previous.administratorId,
    type: 'league.updated',
    message: 'Copa Conferência removida. Demais campeonatos e progresso preservados.',
    amount: 0,
  });
  if (!event.ok) throw new Error(event.error.message);
  const applied = applyEvent(previous, event.value);
  if (!applied.ok) throw new Error(applied.error.message);
  await mkdir(join(directory, '.backups'), { recursive: true });
  await writeFile(
    join(directory, '.backups', `${previous.id}-${now}-without-conference.json.gz.bak`),
    gzipSync(JSON.stringify(saved)),
  );
  await writeFile(
    `${file}.migration.tmp`,
    gzipSync(
      JSON.stringify({ ...saved, state: applied.value, events: [...saved.events, event.value] }),
    ),
  );
  await rename(`${file}.migration.tmp`, file);
  console.log(
    JSON.stringify({
      league: previous.name,
      removedFixtures: previous.fixtures.length - fixtures.length,
      removedCupNodes: previous.cups.length - cups.length,
      preservedRound: applied.value.round,
    }),
  );
}
