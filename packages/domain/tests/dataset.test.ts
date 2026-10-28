import { describe, expect, it } from 'vitest';
import { createWorld, importDataset } from '../src/index.js';
import { worldDatasetSchema } from '@football/shared';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const NOW = Date.parse('2026-10-26T15:00:00Z');
describe('dados substituíveis', () => {
  it('importa dados licenciados, valida referências e aceita calendário fornecido', () => {
    const world = unwrap(
      createWorld({ id: IDS.league, userId: IDS.user, name: 'Dataset', mode: 'offline', now: NOW }),
    );
    const dataset = {
      clubs: world.clubs,
      players: world.players,
      stadiums: world.stadiums,
      centers: world.centers,
      source: 'Dataset autorizado',
      license: 'Dados fictícios para testes',
    };
    expect(importDataset(world, dataset).ok).toBe(true);
    const fixture = world.fixtures[0];
    if (!fixture) throw new Error('Partida ausente');
    const imported = unwrap(importDataset(world, { ...dataset, fixtures: [fixture] }));
    expect(imported.fixtures.filter((item) => !item.group)).toEqual([fixture]);
    expect(imported.fixtures.some((item) => item.group)).toBe(true);
    expect(imported.cups).toHaveLength(0);
    expect(worldDatasetSchema.safeParse({ ...dataset, fixtures: [fixture, fixture] }).success).toBe(
      false,
    );
    expect(
      importDataset(world, {
        ...dataset,
        fixtures: [{ ...fixture, scheduledAt: Date.parse('2026-11-01T04:00:00Z') }],
      }).ok,
    ).toBe(false);
    expect(
      worldDatasetSchema.safeParse({
        ...dataset,
        fixtures: [{ ...fixture, awayId: fixture.homeId }],
      }).success,
    ).toBe(false);
    expect(worldDatasetSchema.safeParse({ ...dataset, clubs: { ids: [], byId: {} } }).success).toBe(
      false,
    );
    expect(
      worldDatasetSchema.safeParse({ ...dataset, players: { ids: [], byId: {} } }).success,
    ).toBe(false);
    const empty = { ids: [], byId: {} };
    expect(
      importDataset(world, {
        ...dataset,
        clubs: empty,
        players: empty,
        stadiums: empty,
        centers: empty,
      }).ok,
    ).toBe(false);
  });
});
