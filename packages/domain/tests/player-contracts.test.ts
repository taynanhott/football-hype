import { worldStateSchema } from '@football/shared';
import { describe, it, expect } from 'vitest';
import {
  createWorld,
  stableId,
  executeCommand,
  applyEvent,
  temporaryModifiers,
  advanceGameDays,
} from '../src/index.js';
import {
  renewalTerms,
  ageFatigueFactor,
  moraleSensitivity,
  maxContractYears,
} from '../src/game/player-contracts.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
function setup() {
  let state = unwrap(
    createWorld({ id: stableId(991, 1), name: 'Contratos', mode: 'offline', userId: 'host', now }),
  );
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const player = {
    ...state.players.byId[club.playerIds[0]!]!,
    age: 25,
    overall: 75,
    morale: 70,
    salary: { cents: 100000, currency: 'BRL' as const },
    marketValue: { cents: 100000000, currency: 'BRL' as const },
  };
  state = {
    ...state,
    players: { ...state.players, byId: { ...state.players.byId, [player.id]: player } },
    management: { ...state.management, contracts: { [player.id]: now + 100 * 86400000 } },
  };
  return { state, club, player };
}
describe('decisões pessoais de contrato e esforço', () => {
  it('recusa iniciativa do clube em contratos longos ou recém renovados', () => {
    const { state, player } = setup();
    expect(
      renewalTerms(
        {
          ...state,
          management: { ...state.management, contracts: { [player.id]: now + 800 * 86400000 } },
        },
        player,
      ).reason,
    ).toContain('dois anos');
    expect(
      renewalTerms(
        {
          ...state,
          management: {
            ...state.management,
            contractHistory: {
              [player.id]: {
                overall: 75,
                marketValue: 100000000,
                signedAt: now,
                dissatisfied: false,
              },
            },
          },
        },
        player,
      ).reason,
    ).toContain('recentemente');
  });
  it('veteranos aceitam redução só perto do término e limitam a duração', () => {
    const { state, player } = setup();
    const veteran = {
      ...player,
      age: 35,
      salary: { ...player.salary, cents: 1000000 },
      marketValue: { ...player.marketValue, cents: 1000000 },
    };
    expect(renewalTerms(state, veteran).minimumSalary).toBeLessThan(veteran.salary.cents);
    expect(
      renewalTerms(
        {
          ...state,
          management: { ...state.management, contracts: { [player.id]: now + 400 * 86400000 } },
        },
        veteran,
      ).minimumSalary,
    ).toBeGreaterThanOrEqual(veteran.salary.cents);
    expect(maxContractYears(35)).toBe(1);
    expect(maxContractYears(32)).toBe(2);
  });
  it('recusa da valorização gera −8 imediatamente, sem acumular, e pagar o pedido remove', () => {
    const setupValue = setup();
    const player = setupValue.player;
    let state = setupValue.state;
    state = {
      ...state,
      management: {
        ...state.management,
        contractHistory: {
          [player.id]: {
            overall: 70,
            marketValue: 50000000,
            signedAt: now - 200 * 86400000,
            dissatisfied: false,
          },
        },
      },
    };
    expect(renewalTerms(state, player).demand).toBe(true);
    const event = unwrap(
      executeCommand(
        state,
        { type: 'management', action: 'reject-renewal', playerId: player.id },
        'host',
        now,
        stableId(991, 2),
      ),
    );
    state = unwrap(applyEvent(state, event));
    expect(
      temporaryModifiers(state, player).find((e) => e.label === 'Insatisfeito com o contrato')
        ?.value,
    ).toBe(-8);
    expect(
      executeCommand(
        state,
        { type: 'management', action: 'reject-renewal', playerId: player.id },
        'host',
        now,
        stableId(991, 3),
      ).ok,
    ).toBe(false);
    const renewed = unwrap(
      executeCommand(
        state,
        {
          type: 'management',
          action: 'renew',
          playerId: player.id,
          years: 1,
          salary: renewalTerms(state, player).minimumSalary,
        },
        'host',
        now,
        stableId(991, 4),
      ),
    );
    state = unwrap(applyEvent(state, renewed));
    expect(
      temporaryModifiers(state, state.players.byId[player.id]!).some(
        (e) => e.label === 'Insatisfeito com o contrato',
      ),
    ).toBe(false);
  });
  it('jovens de baixo overall são tolerantes, veteranos se desgastam mais', () => {
    const { player } = setup();
    expect(moraleSensitivity({ ...player, age: 20, overall: 65 })).toBe(0.15);
    expect(moraleSensitivity({ ...player, age: 20, overall: 85 })).toBe(1);
    expect(ageFatigueFactor(35)).toBeGreaterThan(ageFatigueFactor(30));
    expect(ageFatigueFactor(30)).toBeGreaterThan(ageFatigueFactor(20));
  });
  it('treino individual intenso evolui mais e cansa mais, sem mudar a carga dos colegas', () => {
    const { state, club, player } = setup();
    const center = state.centers.byId[club.trainingCenterId]!;
    const base = {
      ...state,
      fixtures: [],
      cups: [],
      competitionDraws: [],
      roundCalendarVersion: 1,
      players: {
        ...state.players,
        byId: { ...state.players.byId, [player.id]: { ...player, fitness: 70, potential: 99 } },
      },
    };
    const run = (load: 'light' | 'intense') =>
      advanceGameDays(
        {
          ...base,
          centers: {
            ...state.centers,
            byId: {
              ...state.centers.byId,
              [center.id]: {
                ...center,
                operations: {
                  load: 'moderate',
                  playerLoads: { [player.id]: load },
                  fitness: [],
                  medical: [],
                  individual: [],
                  syringe: false,
                },
              },
            },
          },
        },
        now + 3 * 86400000,
      );
    const light = run('light'),
      intense = run('intense');
    expect(intense.development[player.id]).toBeGreaterThan(light.development[player.id]!);
    expect(intense.players.byId[player.id]!.fitness).toBeLessThan(
      light.players.byId[player.id]!.fitness,
    );
    const colleague = club.playerIds[1]!;
    expect(intense.players.byId[colleague]!.fitness).toBe(light.players.byId[colleague]!.fitness);
    expect(intense.centers.byId[center.id]!.operations?.effort?.[player.id]).toBeGreaterThan(0);
  });
  it('persiste a carga individual após comando, evento e recarregamento', () => {
    const initial = setup();
    let { state } = initial;
    const { club, player } = initial;
    const centerId = club.trainingCenterId;
    for (const target of ['light', 'intense', 'moderate'] as const) {
      const event = unwrap(
        executeCommand(
          state,
          { type: 'management', action: 'center', target, playerId: player.id },
          'host',
          now,
          stableId(992, state.revision + 1),
        ),
      );
      state = unwrap(applyEvent(state, event));
      state = worldStateSchema.parse(JSON.parse(JSON.stringify(state)));
      expect(state.centers.byId[centerId]?.operations?.playerLoads?.[player.id]).toBe(target);
      expect(
        state.centers.byId[centerId]?.operations?.playerLoads?.[club.playerIds[1]!],
      ).toBeUndefined();
    }
  });
});
