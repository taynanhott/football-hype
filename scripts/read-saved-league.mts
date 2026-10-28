import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { gameEventSchema, worldStateSchema } from '../packages/shared/src/index.js';

// Maintenance scripts must include events committed since the last checkpoint.
export async function readSavedLeague(file: string) {
  const saved = JSON.parse(gunzipSync(await readFile(file)).toString('utf8'));
  let state = worldStateSchema.parse(saved.state);
  const events = saved.events.map((event: unknown) => gameEventSchema.parse(event));
  const journal = await readFile(`${file}.events`).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return Buffer.alloc(0);
  });
  for (const line of journal
    .subarray(0, journal.lastIndexOf(10) + 1)
    .toString('utf8')
    .split('\n')) {
    if (!line) continue;
    const event = gameEventSchema.parse(JSON.parse(line));
    if (event.sequence <= state.revision) continue;
    if (event.sequence !== state.revision + 1) throw new Error('Histórico da liga incompleto');
    state = Object.assign({}, state, event.patch, { revision: event.sequence });
    events.push(event);
  }
  return { state: worldStateSchema.parse(state), events };
}
