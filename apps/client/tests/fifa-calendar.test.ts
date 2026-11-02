import { describe, expect, it } from 'vitest';
import { GAMEPLAY } from '@football/shared';
import { fifaCalendarBoundary } from '../src/features/competitions/fifa-calendar';

describe('avisos da Data FIFA no calendário', () => {
  it('marca o início e o último dia de todas as janelas do jogo', () => {
    for (const window of GAMEPLAY.fifaWindows) {
      expect(fifaCalendarBoundary(window.start)).toEqual({
        start: window.start,
        end: window.end,
        kind: 'Início',
      });
      expect(fifaCalendarBoundary(window.end)).toEqual({
        start: window.start,
        end: window.end,
        kind: 'Fim',
      });
    }
  });
  it('acompanha o ano exibido sem repetir avisos em dias intermediários', () => {
    expect(fifaCalendarBoundary('2027-03-23')).toEqual({
      start: '2027-03-23',
      end: '2027-03-31',
      kind: 'Início',
    });
    expect(fifaCalendarBoundary('2026-03-29')).toBeUndefined();
    expect(fifaCalendarBoundary('2026-04-01')).toBeUndefined();
  });
});
