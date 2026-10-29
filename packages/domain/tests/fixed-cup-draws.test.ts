import { executeCommand } from '../src/game/commands.js';
import { applyEvent } from '../src/game/events.js';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { FIXED_CUP_ENTRANTS, competitionClubKey, worldStateSchema } from '@football/shared';
import { createWorld } from '../src/game/world-factory.js';
import { importDataset } from '../src/game/data-provider.js';
import { normalizeRoundCalendar } from '../src/competitions/round-calendar.js';
import { realizeCompetitionDraws } from '../src/competitions/competition-draws.js';
const dataset = JSON.parse(
  readFileSync(new URL('../../../data/player-database.json', import.meta.url), 'utf8'),
);
function league(seed: number) {
  const result = createWorld({
    id: crypto.randomUUID(),
    userId: 'draw-test',
    name: 'Sorteios',
    mode: 'offline',
    now: Date.UTC(2026, 0, 11, 11),
    seed,
  });
  if (!result.ok) throw new Error(result.error.message);
  const imported = importDataset(result.value, dataset);
  if (!imported.ok) throw new Error(imported.error.message);
  return normalizeRoundCalendar(imported.value);
}
describe('participantes fixos e sorteios da liga', () => {
  it('confere exatamente os sete conjuntos das imagens, sem clubes substitutos', () => {
    const state = league(123);
    for (const [id, names] of Object.entries(FIXED_CUP_ENTRANTS)) {
      const draw = state.competitionDraws!.find((d) => d.competitionId === id)!;
      expect(draw).toBeDefined();
      expect(draw.completedAt).toBeUndefined();
      expect(
        draw.participantIds.map((id) => competitionClubKey(state.clubs.byId[id]!.name)).sort(),
      ).toEqual(names.map(competitionClubKey).sort());
    }
    for (const id of ['libertadores', 'sul-americana']) {
      const draw = state.competitionDraws!.find((d) => d.competitionId === id)!;
      expect(
        Math.min(...state.fixtures.filter((f) => f.competitionId === id).map((f) => f.scheduledAt)),
      ).toBeGreaterThan(draw.scheduledAt);
    }
    const other = league(456);
    expect(
      state.fixtures
        .filter((f) => f.competitionId === 'copa-verde')
        .map((f) => [f.group, f.homeId, f.awayId]),
    ).not.toEqual(
      other.fixtures
        .filter((f) => f.competitionId === 'copa-verde')
        .map((f) => [f.group, f.homeId, f.awayId]),
    );
  });
  it('aguarda a pré, envia os vencedores à Libertadores e os perdedores à Sula e não refaz o sorteio', () => {
    const state = league(789);
    const pre = state.cups.filter((n) => n.competitionId === 'pre-libertadores');
    expect(pre).toHaveLength(2);
    expect(pre.every((n) => n.legs === 2)).toBe(true);
    const sula = state.competitionDraws!.find((d) => d.competitionId === 'sul-americana')!;
    const blocked = realizeCompetitionDraws(state, sula.scheduledAt);
    expect(blocked.competitionDraws!.find((d) => d.id === sula.id)?.completedAt).toBeUndefined();
    const completed = {
      ...state,
      cups: state.cups.map((n) =>
        n.competitionId === 'pre-libertadores' ? { ...n, winnerId: n.awayId } : n,
      ),
    };
    const drawn = realizeCompetitionDraws(completed, sula.scheduledAt);
    const lib = drawn.competitionDraws!.find((d) => d.competitionId === 'libertadores')!;
    const sul = drawn.competitionDraws!.find((d) => d.competitionId === 'sul-americana')!;
    for (const n of pre) {
      expect(lib.participantIds).toContain(n.awayId);
      expect(lib.participantIds).not.toContain(n.homeId);
      expect(sul.participantIds).toContain(n.homeId);
      expect(sul.participantIds).not.toContain(n.awayId);
    }
    expect(lib.participantIds).toHaveLength(16);
    expect(sul.participantIds).toHaveLength(16);
    expect(sul.completedAt).toBe(sula.scheduledAt);
    expect(realizeCompetitionDraws(drawn, sula.scheduledAt)).toBe(drawn);
    expect(worldStateSchema.safeParse(drawn).success).toBe(true);
  });
  it('o campeão da Sula entra na Libertadores apenas na temporada seguinte', () => {
    const state = league(999);
    const champion = state.clubs.ids.find(
      (id) => state.clubs.byId[id]!.name === 'Rosario Central',
    )!;
    const opponent = state.clubs.ids.find((id) => state.clubs.byId[id]!.name === 'Santos')!;
    expect(
      state.fixtures
        .filter((f) => f.competitionId === 'libertadores')
        .some((f) => f.homeId === champion || f.awayId === champion),
    ).toBe(false);
    const finished = {
      ...state,
      status: 'finished' as const,
      cups: [
        ...state.cups.filter((n) => n.competitionId !== 'sul-americana'),
        {
          id: 'sul-americana:test-final',
          competitionId: 'sul-americana',
          round: 3,
          homeId: champion,
          awayId: opponent,
          leftId: null,
          rightId: null,
          winnerId: champion,
          scheduledAt: state.lastProcessedAt,
          legs: 1 as const,
        },
      ],
    };
    const event = executeCommand(
      finished,
      { type: 'new-season' },
      state.administratorId,
      Date.UTC(2027, 0, 1),
      crypto.randomUUID(),
    );
    if (!event.ok) throw new Error(event.error.message);
    const applied = applyEvent(finished, event.value);
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.season).toBe(state.season + 1);
    expect(
      applied.value.fixtures
        .filter((f) => f.competitionId === 'libertadores')
        .some((f) => f.homeId === champion || f.awayId === champion),
    ).toBe(true);
  });
});
