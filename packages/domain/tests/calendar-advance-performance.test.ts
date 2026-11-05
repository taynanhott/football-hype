import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createWorld, importDataset, executeCommand, stableId } from '../src/index.js';
import { worldDatasetSchema } from '@football/shared';

it.skipIf(process.env.CALENDAR_PERFORMANCE !== '1')(
  'measures twenty advances using the production player database in both modes',
  () => {
    const dataset = worldDatasetSchema.parse(
      JSON.parse(readFileSync('data/player-database.json', 'utf8')),
    );
    const measurements = [];
    for (const mode of ['offline', 'multiplayer'] as const) {
      const created = createWorld({
        id: stableId(997, 1),
        userId: 'host',
        name: 'Performance',
        mode,
        now: Date.UTC(2026, 0, 15),
      });
      if (!created.ok) throw Error('world');
      const imported = importDataset(created.value, dataset);
      if (!imported.ok) throw Error('dataset');
      let state = imported.value;
      const samples = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        const ev = executeCommand(
          state,
          { type: 'advance' },
          'host',
          Date.UTC(2026, 0, 16),
          stableId(998, i + 1),
        );
        if (!ev.ok) throw Error(ev.error.message);
        // LeagueService applies events validated by executeCommand without parsing them again.
        state = { ...state, ...ev.value.patch, revision: ev.value.sequence };
        samples.push(performance.now() - start);
      }
      const sorted = [...samples].sort((a, b) => a - b);
      measurements.push({
        mode,
        players: state.players.ids.length,
        samples,
        medianMs: (sorted[9]! + sorted[10]!) / 2,
        p95Ms: sorted[18],
        finalStateHash: createHash('sha256').update(JSON.stringify(state)).digest('hex'),
      });
      expect(state.results.length).toBeGreaterThan(0);
    }
    const output = {
      scope:
        'Local shared domain processing, production player dataset, twenty advances per mode. Excludes storage, network and browser rendering.',
      measurements,
    };
    writeFileSync(
      `tmp/calendar-advance-${process.env.CALENDAR_BENCHMARK_LABEL ?? 'after'}.json`,
      JSON.stringify(output, null, 2),
    );
    console.log(JSON.stringify(output));
  },
  120000,
);
