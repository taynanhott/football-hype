import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createWorld, resolveLineup } from '@football/domain';
import { SquadAverages } from '../src/features/players/squad-averages';
import { unwrap } from '../../../tests/fixtures/domain';

describe('médias efetivas dos titulares', () => {
  it('inclui buffs e debuffs antes da média, desconta condição uma vez e soma o bônus coletivo uma vez', () => {
    const state = unwrap(
      createWorld({
        id: '00000090-0000-4000-8000-000000000005',
        name: 'Teste',
        mode: 'offline',
        userId: 'host',
        now: Date.parse('2026-10-26T15:00:00Z'),
      }),
    );
    const club = Object.values(state.clubs.byId)[0]!;
    const resolved = resolveLineup(state, club, state.lastProcessedAt);
    const lineup = [
      { base: 81, adjusted: 83, fitness: 83 },
      { base: 81, adjusted: 79, fitness: 83 },
      { base: 78, adjusted: 78, fitness: 87 },
      { base: 69, adjusted: 69, fitness: 100 },
    ].map((value, index) => ({
      ...resolved[index]!,
      position: 'CB' as const,
      chemistry: 100,
      effectiveOverall: value.adjusted,
      player: { ...resolved[index]!.player!, overall: value.base, fitness: value.fitness },
    }));
    // Cards show 79, 76, 75 and 69 after the same physical adjustment.
    // floor((79 + 76 + 75 + 69) / 4 + 3) = 77.
    const fullLineup = [
      ...lineup,
      ...resolved.slice(4).map((entry) => ({
        ...entry,
        position: 'CM' as const,
        chemistry: 100,
        effectiveOverall: 70,
        player: { ...entry.player!, fitness: 100 },
      })),
    ];
    const html = renderToStaticMarkup(
      createElement(SquadAverages, { state, club, lineup: fullLineup }),
    );
    expect(html).toMatch(/<span>Defesa<\/span><strong[^>]*>77<\/strong>/);
    expect(html).toMatch(/<span>Geral<\/span><strong[^>]*>74<\/strong>/);
    expect(lineup[0]!.player.overall).toBe(81);
  });
});
