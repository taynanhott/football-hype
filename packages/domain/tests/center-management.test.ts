import { beforeEach, describe, expect, it } from 'vitest';
import { worldStateSchema, type WorldState, type GameCommand } from '@football/shared';
import {
  createWorld,
  stableId,
  executeCommand,
  applyEvent,
  playNextBatch,
  pendingFixtures,
  medicallyAvailable,
} from '../src/index.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
let state: WorldState;
const own = () => state.clubs.byId[state.participants[0]!.clubId]!;
const center = () => state.centers.byId[own().trainingCenterId]!;
function act(target: string, playerId?: string) {
  const command: GameCommand = {
    type: 'management',
    action: 'center',
    target,
    ...(playerId ? { playerId } : {}),
  };
  const result = executeCommand(state, command, 'host', now, stableId(95, state.revision + 1));
  if (result.ok) state = unwrap(applyEvent(state, result.value));
  return result;
}
beforeEach(() => {
  state = unwrap(
    createWorld({ id: stableId(94, 1), name: 'Centro', mode: 'offline', userId: 'host', now }),
  );
  const c = center();
  state = {
    ...state,
    centers: {
      ...state.centers,
      byId: {
        ...state.centers.byId,
        [c.id]: { ...c, levels: { ...c.levels, fitness: 3, medical: 5, coaching: 1 } },
      },
    },
  };
});
describe('gerenciamento do centro', () => {
  it('cobra tratamento e impede duplicidade e excesso de vagas', () => {
    const ids = own().playerIds;
    for (const id of ids.slice(0, 2))
      state = {
        ...state,
        players: {
          ...state.players,
          byId: { ...state.players.byId, [id]: { ...state.players.byId[id]!, fitness: 40 } },
        },
      };
    const balance = own().balance.cents;
    expect(act('fitness', ids[0]).ok).toBe(true);
    expect(own().balance.cents).toBe(balance - 2500000);
    expect(act('fitness', ids[0]).ok).toBe(false);
    expect(act('fitness', ids[1]).ok).toBe(false);
    expect(center().operations?.fitness).toEqual([ids[0]]);
  });
  it('guarda apenas uma seringa e consome a liberação na próxima partida', () => {
    const id = own().playerIds[0]!;
    state = { ...state, injuries: { ...state.injuries, [id]: 60 } };
    expect(act('buy-syringe').ok).toBe(true);
    expect(act('buy-syringe').ok).toBe(false);
    expect(act('use-syringe', id).ok).toBe(true);
    expect(center().operations?.syringe).toBe(false);
    expect(medicallyAvailable(state, id)).toBe(true);
    const fixture = center().operations!.clearance!.fixtureId;
    while (!state.results.some((r) => r.fixtureId === fixture))
      state = unwrap(playNextBatch(state, now));
    expect(center().operations?.clearance).toBeUndefined();
    expect(medicallyAvailable(state, id)).toBe(false);
    expect(state.injuries[id]).toBeGreaterThan(0);
    expect(worldStateSchema.safeParse(state).success).toBe(true);
  });
  it('respeita o limite individual e conclui o ciclo com +1 de overall', () => {
    const id = own().playerIds[0]!;
    expect(act('individual', id).ok).toBe(true);
    expect(act('individual', own().playerIds[1]).ok).toBe(false);
    const p = state.players.byId[id]!;
    const c = center();
    const next = pendingFixtures(state)[0]!;
    state = {
      ...state,
      injuries: { ...state.injuries, [id]: 100 },
      centers: {
        ...state.centers,
        byId: {
          ...state.centers.byId,
          [c.id]: {
            ...c,
            operations: {
              ...c.operations!,
              individual: [
                {
                  playerId: id,
                  startedAt: next.scheduledAt - 60 * 86400000,
                  endsAt: next.scheduledAt,
                },
              ],
            },
          },
        },
      },
    };
    state = unwrap(playNextBatch(state, now));
    expect(state.players.byId[id]!.overall).toBe(p.overall + 1);
    expect(center().operations?.individual).toHaveLength(0);
    expect(worldStateSchema.safeParse(state).success).toBe(true);
  });
  it('aplica carga e tratamento médico sem criar valores fracionários inválidos', () => {
    const id = own().playerIds[0]!;
    state = { ...state, injuries: { ...state.injuries, [id]: 8 } };
    expect(act('medical', id).ok).toBe(true);
    expect(act('intense').ok).toBe(true);
    for (let i = 0; i < 3; i++) state = unwrap(playNextBatch(state, now));
    expect(worldStateSchema.safeParse(state).success).toBe(true);
    expect(center().operations?.load).toBe('intense');
    expect(state.injuries[id]).toBeLessThan(8);
  });
});

it('salva as cargas do elenco em uma única ação e rejeita jogadores de outro clube atomicamente', () => {
  const [first, second] = own().playerIds;
  const command: GameCommand = {
    type: 'management',
    action: 'center',
    target: 'save-training',
    playerLoads: { [first!]: 'light', [second!]: 'intense' },
  };
  const result = unwrap(executeCommand(state, command, 'host', now, stableId(995, 1)));
  state = unwrap(applyEvent(state, result));
  expect(center().operations?.playerLoads).toMatchObject({
    [first!]: 'light',
    [second!]: 'intense',
  });
  const outsider = Object.values(state.players.byId).find(
    (p) => p.clubId && p.clubId !== own().id,
  )!;
  const invalid = executeCommand(
    state,
    { ...command, playerLoads: { [first!]: 'moderate', [outsider.id]: 'light' } },
    'host',
    now,
    stableId(995, 2),
  );
  expect(invalid.ok).toBe(false);
  expect(center().operations?.playerLoads?.[first!]).toBe('light');
});
