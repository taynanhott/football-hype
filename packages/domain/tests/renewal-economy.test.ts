import { describe, expect, it } from 'vitest';
import { createWorld, stableId, advanceGameDays } from '../src/index.js';
import {
  renewalSalaryBaseline,
  renewalTerms,
  developmentPaused,
} from '../src/game/player-contracts.js';
import {
  officialMatchDevelopment,
  emptyTrainingProgression,
} from '../src/game/training-progression.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const now = Date.UTC(2026, 0, 15, 12);
const original = unwrap(
  createWorld({ id: stableId(831, 1), userId: 'host', name: 'Renovação', mode: 'offline', now }),
);
const club = original.clubs.byId[original.participants[0]!.clubId]!;
const player = {
  ...original.players.byId[club.playerIds[0]!]!,
  age: 20,
  overall: 60,
  potential: 95,
  salary: { cents: 100000, currency: 'BRL' as const },
};
const state = {
  ...original,
  fixtures: [],
  cups: [],
  lastProcessedAt: now + 200 * 86400000,
  clubs: {
    ...original.clubs,
    byId: { ...original.clubs.byId, [club.id]: { ...club, leagueStrength: 65 } },
  },
  players: { ...original.players, byId: { ...original.players.byId, [player.id]: player } },
  management: {
    ...original.management,
    contractHistory: {
      [player.id]: {
        overall: 60,
        marketValue: player.marketValue.cents,
        signedAt: now,
        dissatisfied: false,
      },
    },
  },
};
describe('renovações sustentáveis e talentos acima da liga', () => {
  it('limita reajustes comuns e aumenta a exigência conforme a evolução', () => {
    expect(renewalSalaryBaseline(state, player)).toBeLessThanOrEqual(player.salary.cents * 1.05);
    expect(renewalSalaryBaseline(state, { ...player, overall: 65 })).toBeGreaterThan(
      renewalSalaryBaseline(state, player),
    );
  });
  it('cobra referência de mercado de um destaque sem limitar ao caixa', () => {
    const star = { ...player, overall: 80 };
    expect(renewalSalaryBaseline(state, star)).toBeGreaterThan(player.salary.cents * 3);
    const broke = {
      ...state,
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: {
            ...state.clubs.byId[club.id]!,
            balance: { cents: 0, currency: 'BRL' as const },
          },
        },
      },
    };
    expect(renewalSalaryBaseline(broke, star)).toBe(renewalSalaryBaseline(state, star));
    expect(renewalTerms(state, { ...star, overall: 95 }).reason).toContain('liga mais forte');
  });
  it('pausa evolução permanente nos jogos após recusa e retoma sem perder progresso', () => {
    const pending = {
      ...state,
      management: {
        ...state.management,
        contractHistory: {
          [player.id]: { ...state.management.contractHistory[player.id]!, dissatisfied: true },
        },
      },
    };
    const paused = officialMatchDevelopment(
      player,
      0.75,
      emptyTrainingProgression(),
      5,
      true,
      developmentPaused(pending, player.id),
    );
    expect(paused.development).toBe(0.75);
    expect(paused.player.overall).toBe(player.overall);
    expect(
      officialMatchDevelopment(
        player,
        0.75,
        emptyTrainingProgression(),
        5,
        true,
        developmentPaused(state, player.id),
      ).development,
    ).toBeGreaterThan(0.75);
  });
  it('também pausa a evolução dos treinos diários', () => {
    const pending = {
      ...state,
      development: { [player.id]: 0.5 },
      management: {
        ...state.management,
        contractHistory: {
          [player.id]: { ...state.management.contractHistory[player.id]!, dissatisfied: true },
        },
      },
    };
    const stopped = advanceGameDays(pending, pending.lastProcessedAt + 3 * 86400000);
    expect(stopped.development[player.id]).toBe(0.5);
    const active = advanceGameDays(
      { ...pending, management: state.management },
      pending.lastProcessedAt + 3 * 86400000,
    );
    expect(active.development[player.id]).toBeGreaterThan(0.5);
  });
});
