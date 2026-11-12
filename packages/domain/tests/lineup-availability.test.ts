import type { WorldState } from '@football/shared';
import { describe, expect, it } from 'vitest';
import {
  createWorld,
  resolveLineup,
  resolveBench,
  playerAvailable,
  executeCommand,
  playNextBatch,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const during = Date.parse('2026-03-25T18:00:00-03:00');
const after = Date.parse('2026-04-01T18:00:00-03:00');
const eventId = '00000000-0000-4000-8000-00000000000a';
function fixture() {
  const original = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Disponibilidade',
      mode: 'offline',
      now: during,
    }),
  );
  const club = original.clubs.byId[original.participants[0]!.clubId]!;
  const players = Object.fromEntries(
    Object.entries(original.players.byId).map(([id, p]) => [id, { ...p, overall: 70 }]),
  );
  const state = {
    ...original,
    lastProcessedAt: during,
    nextScheduledAt: during,
    players: { ...original.players, byId: players },
  };
  const starters = resolveLineup(state, club, after).map((e) => e.player!.id);
  const bench = resolveBench(state, club, after, starters);
  state.tactics = { ...state.tactics, [club.id]: { formation: '4-3-3' as const, starters, bench } };
  const calledUp = starters[0]!;
  state.players.byId[calledUp] = { ...state.players.byId[calledUp]!, overall: 85 };
  return { state, club, starters, bench, calledUp };
}
describe('disponibilidade compartilhada da escalação', () => {
  it('preserva o titular afastado ao salvar ajustes e restaura sua posição no retorno', () => {
    const { state, club, starters } = fixture();
    const legal = resolveLineup(state, club, during).map((entry) => entry.player!.id);
    const bench = resolveBench(state, club, during, legal);
    const next = unwrap(
      executeCommand(
        state,
        {
          type: 'lineup',
          formation: '4-3-3',
          starters: legal,
          bench,
        },
        IDS.user,
        during,
        eventId,
      ),
    );
    expect(next.patch.tactics?.[club.id]?.starters[0]).toBe(starters[0]);
    expect(
      resolveLineup({ ...state, ...next.patch } as WorldState, club, after)[0]?.player?.id,
    ).toBe(starters[0]);
  });
  it('permite escalar antes da janela e revalida a convocação na data efetiva do jogo', () => {
    const { state, club, starters, bench, calledUp } = fixture();
    const before = { ...state, lastProcessedAt: Date.parse('2026-03-22T18:00:00-03:00') };
    const command = { type: 'lineup' as const, formation: '4-3-3' as const, starters, bench };
    expect(executeCommand(before, command, IDS.user, before.lastProcessedAt, eventId).ok).toBe(
      true,
    );
    expect(resolveLineup(before, club, before.lastProcessedAt).map((e) => e.player?.id)).toContain(
      calledUp,
    );
    expect(resolveLineup(before, club, during).map((e) => e.player?.id)).not.toContain(calledUp);
    expect(executeCommand(state, command, IDS.user, during, eventId).ok).toBe(false);
  });
  it('afasta convocados e lesionados, preserva preferências e restaura titulares e banco ao retornar', () => {
    const { state, club, starters, bench, calledUp } = fixture();
    const injured = bench[0]!;
    state.injuries = { ...state.injuries, [injured]: 2 };
    const lineup = resolveLineup(state, club, during).flatMap((e) =>
      e.player ? [e.player.id] : [],
    );
    const reserves = resolveBench(state, club, during, lineup);
    expect(lineup).toHaveLength(11);
    expect([...lineup, ...reserves]).not.toContain(calledUp);
    expect([...lineup, ...reserves]).not.toContain(injured);
    expect(state.tactics[club.id]?.starters).toEqual(starters);
    expect(state.tactics[club.id]?.bench).toEqual(bench);
    const recovered = {
      ...state,
      lastProcessedAt: after,
      injuries: { ...state.injuries, [injured]: 0 },
    };
    const restored = resolveLineup(recovered, club, after).map((e) => e.player!.id);
    expect(restored).toEqual(starters);
    expect(resolveBench(recovered, club, after, restored)).toEqual(bench);
  });
  it('bloqueia no servidor titulares e reservas convocados, inclusive em trocas planejadas', () => {
    const { state, club, starters, bench, calledUp } = fixture();
    const command = { type: 'lineup' as const, formation: '4-3-3' as const, starters, bench };
    expect(executeCommand(state, command, IDS.user, during, eventId).ok).toBe(false);
    const legal = resolveLineup(state, club, during).map((e) => e.player!.id);
    expect(
      executeCommand(
        state,
        {
          ...command,
          starters: legal,
          bench: [calledUp],
          instructions: {
            substitutions: [{ out: legal[0]!, in: calledUp, when: 60, score: 'always' }],
            protected: [],
            situations: [],
          },
        },
        IDS.user,
        during,
        eventId,
      ).ok,
    ).toBe(false);
    expect(playerAvailable(state, calledUp, during)).toBe(false);
    expect(playerAvailable(state, calledUp, after)).toBe(true);
  });
  it('não usa convocados nos titulares, no banco ou nas substituições da partida efetiva', () => {
    const { state, club, calledUp } = fixture();
    const opponent = state.clubs.ids.find(
      (id) => id !== club.id && state.clubs.byId[id]?.country === 'BR',
    )!;
    state.fixtures = [
      {
        id: 'callup-match',
        competitionId: 'serie-a',
        round: 0,
        homeId: club.id,
        awayId: opponent,
        scheduledAt: during,
      },
    ];
    state.cups = [];
    state.competitionDraws = [];
    state.roundCalendarVersion = 1;
    state.roundDates = { 'serie-a:league:0': during };
    state.seasonClock = undefined;
    const next = unwrap(playNextBatch(state, during));
    const result = next.results.find((r) => r.fixtureId === 'callup-match')!;
    expect(result).toBeDefined();
    expect(result.lineups?.home).not.toContain(calledUp);
    expect(result.tacticalPlans?.home?.bench).not.toContain(calledUp);
    expect(result.substitutions?.map((s) => s.in) ?? []).not.toContain(calledUp);
  });
});
