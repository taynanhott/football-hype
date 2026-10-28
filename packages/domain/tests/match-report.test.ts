import { describe, expect, it } from 'vitest';
import { createWorld, playNextBatch, simulateMatch } from '../src/index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-10-26T15:00:00Z');
describe('relatórios persistentes de partidas', () => {
  it('as estatísticas e placar correspondem aos lances e expulsos não voltam a jogar', () => {
    const state = unwrap(
      createWorld({
        id: '00000090-0000-4000-8000-000000000005',
        name: 'Partida',
        mode: 'offline',
        userId: 'host',
        now,
      }),
    );
    const fixture = state.fixtures[0]!;
    const home = state.clubs.byId[fixture.homeId]!;
    const away = state.clubs.byId[fixture.awayId]!;
    let minimumGap = Infinity,
      corners = 0,
      walls = 0,
      saves = 0,
      interceptions = 0;
    for (let seed = 0; seed < 30; seed++) {
      const result = simulateMatch(
        fixture,
        home.playerIds.slice(0, 11).map((id) => state.players.byId[id]!),
        away.playerIds.slice(0, 11).map((id) => state.players.byId[id]!),
        state.stadiums.byId[home.stadiumId]!,
        seed,
      );
      expect(result.durationMs).toBe(90000);
      expect(result.statistics!.home.possession + result.statistics!.away.possession).toBe(100);
      for (const side of ['home', 'away'] as const) {
        const events = result.actions!.filter((a) => a.side === side);
        expect(result.statistics![side].shots).toBe(events.filter((a) => a.type === 'shot').length);
        expect(result.statistics![side].shotsOnTarget).toBe(
          events.filter((a) => a.type === 'shot' && a.onTarget).length,
        );
        expect(side === 'home' ? result.homeGoals : result.awayGoals).toBe(
          events.filter((a) => a.type === 'goal').length,
        );
      }
      for (const [index, event] of result.actions!.entries()) {
        if (event.type === 'red')
          expect(result.actions!.slice(index + 1).some((a) => a.playerId === event.playerId)).toBe(
            false,
          );
        if (event.type === 'goal' && event.assistId)
          expect(event.assistId).not.toBe(event.playerId);
      }
      corners += result.actions?.filter((a) => a.type === 'corner').length ?? 0;
      walls +=
        result.actions?.filter((a) => a.type === 'free-kick' && (a.wallIds?.length ?? 0) >= 3)
          .length ?? 0;
      saves +=
        result.actions?.filter((a) => a.type === 'shot' && a.outcome === 'saved').length ?? 0;
      interceptions += result.actions?.filter((a) => a.type === 'interception').length ?? 0;
      const removed = new Set<string>();
      const lineup = [...home.playerIds.slice(0, 11), ...away.playerIds.slice(0, 11)];
      for (const event of result.actions ?? []) {
        if (event.type === 'red' && event.playerId) removed.add(event.playerId);
        for (let a = 0; a < lineup.length; a++)
          for (let b = a + 1; b < lineup.length; b++) {
            if (removed.has(lineup[a]!) || removed.has(lineup[b]!)) continue;
            const coords = event.coordinates!;
            minimumGap = Math.min(
              minimumGap,
              Math.hypot(coords[a * 2]! - coords[b * 2]!, coords[a * 2 + 1]! - coords[b * 2 + 1]!) /
                10,
            );
          }
        if (event.type === 'shot') {
          if (event.outcome === 'saved') {
            expect(Math.abs(event.endZ ?? 0)).toBeLessThan(50);
            expect(event.keeperId).toBeTruthy();
            expect(event.keeperDive).toBeTruthy();
          }
          if (event.outcome === 'goal')
            expect(
              result.actions?.some(
                (a) =>
                  a.type === 'goal' && a.minute === event.minute && a.playerId === event.playerId,
              ),
            ).toBe(true);
          else
            expect(Math.abs(event.endX ?? 0) < 3.65 && Math.abs(event.endZ ?? 0) > 51).toBe(false);
          expect(state.players.byId[event.playerId ?? '']?.position).not.toBe('GK');
          const direction = event.side === 'home' ? 1 : -1;
          expect(Math.hypot(event.x, 51 - event.z * direction)).toBeLessThanOrEqual(
            event.setPiece === 'free-kick' ? 34.01 : 26.01,
          );
          expect(event.z * direction).toBeGreaterThanOrEqual(event.setPiece ? 17 : 27);
        }
        for (const [index, id] of lineup.entries()) {
          if (state.players.byId[id]?.position !== 'GK') continue;
          const x = event.coordinates?.[index * 2] ?? 0;
          const z = event.coordinates?.[index * 2 + 1] ?? 0;
          expect(Math.abs(x)).toBeLessThanOrEqual(60);
          expect(index < 11 ? z : -z).toBeLessThanOrEqual(-420);
        }
        if (event.type === 'pass' || event.type === 'cross') {
          const own = event.side === 'home' ? home : away;
          expect(own.playerIds).toContain(event.playerId);
          expect(own.playerIds).toContain(event.targetId);
        }
        if (event.type === 'pass') {
          const target = lineup.indexOf(
            (event.outcome === 'intercepted' ? event.interceptorId : event.targetId) ?? '',
          );
          expect(target).toBeGreaterThanOrEqual(0);
          expect(event.endX).toBe((event.coordinates?.[target * 2] ?? 0) / 10);
          expect(event.endZ).toBe((event.coordinates?.[target * 2 + 1] ?? 0) / 10);
          expect(Math.hypot(event.endX! - event.x, event.endZ! - event.z)).toBeLessThan(31.1);
        }
      }
      expect(Object.values(result.ratings!).every((r) => r >= 0 && r <= 10)).toBe(true);
    }
    expect(minimumGap).toBeGreaterThan(1.6);
    expect(corners).toBeGreaterThan(0);
    expect(walls).toBeGreaterThan(0);
    expect(saves).toBeGreaterThan(0);
    expect(interceptions).toBeGreaterThan(0);
  }, 15000);
  it('salva notas históricas e um início comum a todas as partidas da rodada', () => {
    const state = unwrap(
      createWorld({
        id: '00000090-0000-4000-8000-000000000006',
        name: 'Rodada',
        mode: 'offline',
        userId: 'host',
        now,
      }),
    );
    const next = unwrap(playNextBatch(state, now));
    expect(next.results.length).toBeGreaterThan(1);
    expect(new Set(next.results.map((r) => r.startedAt))).toEqual(new Set([now]));
    expect(next.ratingHistory.length).toBe(
      next.results.reduce((sum, r) => sum + Object.keys(r.ratings ?? {}).length, 0),
    );
    expect(state.ratingHistory).toHaveLength(0);
  });
});
