import { describe, it, expect } from 'vitest';
import {
  competitionDates,
  seasonStart,
  cupReturnDate,
} from '../src/competitions/season-calendar.js';
import { createWorld, stableId } from '../src/game/world-factory.js';
import { importDataset } from '../src/game/data-provider.js';

describe('calendário da temporada', () => {
  it('separa as partidas de ida e volta pelas datas da competição', () => {
    expect(
      new Date(cupReturnDate('copa-brasil', Date.parse('2026-04-22T23:30:00Z'))).toISOString(),
    ).toBe('2026-05-13T23:30:00.000Z');
    expect(cupReturnDate('libertadores', Date.parse('2026-08-12T23:30:00Z'))).toBe(
      Date.parse('2026-08-19T23:30:00Z'),
    );
  });
  it('inicia em 11 de janeiro mesmo quando a liga é criada em outubro', () => {
    const result = createWorld({
      id: stableId(90, 901),
      userId: 'calendar-test',
      name: 'Calendário',
      mode: 'offline',
      now: Date.parse('2026-10-28T15:00:00Z'),
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.lastProcessedAt).toBe(seasonStart(2026));
    expect(result.value.createdAt).toBe(seasonStart(2026));
    const serieA = result.value.fixtures.filter((game) => game.competitionId === 'serie-a');
    expect(
      new Date(Math.min(...serieA.map((game) => game.scheduledAt))).toISOString().slice(0, 10),
    ).toBe('2026-01-28');
    const imported = importDataset(result.value, {
      source: 'Calendar test',
      license: 'Test',
      clubs: result.value.clubs,
      players: result.value.players,
      stadiums: result.value.stadiums,
      centers: result.value.centers,
    });
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.value.lastProcessedAt).toBe(seasonStart(2026));
  });
  it('respeita as janelas de estreia e a pausa de junho e julho', () => {
    expect(new Date(competitionDates('serie-b', 2026, 38)[0]!).toISOString().slice(0, 10)).toBe(
      '2026-03-21',
    );
    expect(new Date(competitionDates('serie-c', 2026, 19)[0]!).toISOString().slice(0, 10)).toBe(
      '2026-04-05',
    );
    expect(competitionDates('serie-a', 2026, 38)).toHaveLength(38);
    for (const date of competitionDates('serie-a', 2026, 38))
      expect(date < Date.parse('2026-06-01') || date > Date.parse('2026-07-19')).toBe(true);
    expect(
      competitionDates('libertadores', 2026, 6).map((date) => new Date(date).getUTCMonth()),
    ).toEqual([3, 3, 3, 4, 4, 4]);
    expect(new Date(competitionDates('libertadores', 2026, 4, true)[0]!).getUTCMonth()).toBe(7);
  });
});
