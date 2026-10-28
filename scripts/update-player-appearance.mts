import { readSavedLeague } from './read-saved-league.mts';
import { writeFile, readdir, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { worldStateSchema, portraitAppearance } from '../packages/shared/src/index.js';
import { recordEvent, applyEvent } from '../packages/domain/src/index.js';
const directory = fileURLToPath(new URL('../apps/server/.local/real-leagues/', import.meta.url));
for (const filename of await readdir(directory)) {
  if (!filename.endsWith('.json.gz')) continue;
  const file = join(directory, filename);
  const saved = await readSavedLeague(file);
  const previous = worldStateSchema.parse(saved.state);
  if (previous.deletedAt) continue;
  let changed = 0;
  const byId = Object.fromEntries(
    Object.entries(previous.players.byId).map(([id, player]) => {
      const appearance = portraitAppearance(player);
      if (JSON.stringify(appearance) !== JSON.stringify(player.appearance)) changed++;
      return [id, { ...player, appearance }];
    }),
  );
  if (!changed) continue;
  const next = { ...previous, players: { ...previous.players, byId } };
  const now = Date.now();
  const event = recordEvent(previous, next, {
    id: randomUUID(),
    occurredAt: now,
    actorId: previous.administratorId,
    type: 'league.updated',
    message: 'Aparência dos jogadores atualizada com os registros do arquivo original.',
    amount: 0,
  });
  if (!event.ok) throw new Error(event.error.message);
  const applied = applyEvent(previous, event.value);
  if (!applied.ok) throw new Error(applied.error.message);
  await mkdir(join(directory, '.backups'), { recursive: true });
  await writeFile(
    join(directory, '.backups', `${previous.id}-${now}-appearance.json.gz.bak`),
    gzipSync(JSON.stringify(saved)),
  );
  await writeFile(
    `${file}.appearance.tmp`,
    gzipSync(
      JSON.stringify({ ...saved, state: applied.value, events: [...saved.events, event.value] }),
    ),
  );
  await rename(`${file}.appearance.tmp`, file);
  console.log(
    JSON.stringify({ league: previous.name, updatedPlayers: changed, round: applied.value.round }),
  );
}
