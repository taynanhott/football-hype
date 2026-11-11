/// <reference types="vite/client" />
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { createWorld, resolveBench, resolveLineup } from '@football/domain';
import { MatchBench } from '../src/features/players/match-bench';
import { IDS, unwrap } from '../../../tests/fixtures/domain';

vi.mock('../src/features/players/pixel-portrait', () => ({ Portrait: () => null }));
vi.mock('../src/features/players/match-instructions', () => ({ UnavailablePlayers: () => null }));
vi.mock('../src/features/players/player-card', () => ({ PlayerCard: () => null }));
vi.mock('../src/features/players/player-modal', () => ({ PlayerModal: () => null }));
vi.mock('../src/store/game-store', () => ({
  useGameStore: Object.assign(() => ({}), { getState: () => ({}) }),
}));

it('mostra indisponíveis somente em não relacionados, desativados, e restaura o banco ao voltar', () => {
  const during = Date.parse('2026-03-25T18:00:00-03:00');
  const after = Date.parse('2026-04-01T18:00:00-03:00');
  const base = unwrap(
    createWorld({ id: IDS.league, userId: IDS.user, name: 'Banco', mode: 'offline', now: during }),
  );
  const club = base.clubs.byId[base.participants[0]!.clubId]!;
  const state = {
    ...base,
    lastProcessedAt: during,
    nextScheduledAt: during,
    players: {
      ...base.players,
      byId: Object.fromEntries(
        Object.entries(base.players.byId).map(([id, p]) => [id, { ...p, overall: 70 }]),
      ),
    },
  };
  state.fixtures = [
    {
      id: 'bench-game',
      competitionId: 'serie-a',
      homeId: club.id,
      awayId: base.clubs.ids.find((id) => id !== club.id)!,
      round: 0,
      scheduledAt: during,
    },
  ];
  state.cups = [];
  state.competitionDraws = [];
  state.roundCalendarVersion = 1;
  const starters = resolveLineup(state, club, after).map((e) => e.player!.id);
  const reserves = resolveBench(state, club, after, starters);
  const calledUp = starters[0]!,
    injured = reserves[0]!;
  const suspended = reserves[1]!;
  state.players.byId[calledUp] = { ...state.players.byId[calledUp]!, overall: 85 };
  state.injuries = { ...state.injuries, [injured]: 2 };
  const unavailableState = {
    ...state,
    discipline: {
      version: 1 as const,
      competitions: {
        'serie-a': { [suspended]: { yellowCards: 0, suspendedGames: 1 } },
      },
    },
  };
  const render = (current: typeof state) =>
    renderToStaticMarkup(
      createElement(MatchBench, {
        state: current,
        club,
        starters,
        reserves,
        onChange: vi.fn(),
        onMove: vi.fn(),
      }),
    );
  const html = render(unavailableState);
  const related = html.match(/<details class="reserve-section related"[\s\S]*?<\/details>/)![0];
  const unrelated = html.match(/<details class="reserve-section unrelated"[\s\S]*?<\/details>/)![0];
  for (const id of [calledUp, injured, suspended]) {
    expect(related).not.toContain(`data-drag-player-id="${id}"`);
    const button = unrelated.match(new RegExp(`<button[^>]*data-drag-player-id="${id}"[^>]*>`))![0];
    expect(button).toContain('disabled=""');
    expect(button).toContain('draggable="false"');
    expect(button).toContain('reserve-mini-unavailable');
  }
  const recovered = render({
    ...state,
    lastProcessedAt: after,
    nextScheduledAt: after,
    fixtures: [],
    injuries: { ...state.injuries, [injured]: 0 },
  });
  expect(recovered).not.toContain('reserve-mini-unavailable');
  const restored = recovered.match(
    /<details class="reserve-section related"[\s\S]*?<\/details>/,
  )![0];
  expect(restored).toContain(`data-drag-player-id="${injured}"`);
});
