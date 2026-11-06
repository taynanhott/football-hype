import { describe, expect, it } from 'vitest';
import { positionSchema } from '@football/shared';
import { canLearnPosition, positionFactor, resolveLineup } from '../src/game/tactics.js';
import { createWorld, stableId } from '../src/game/world-factory.js';
import { unwrap } from '../../../tests/fixtures/domain.js';

describe('penalidade por proximidade das posições', () => {
  it('aplica a penalidade de lateral no meio desde a primeira leitura da escalação', () => {
    const state = unwrap(
      createWorld({
        id: stableId(707, 1),
        userId: 'host',
        name: 'Posições iniciais',
        mode: 'offline',
        now: 1,
      }),
    );
    const club = state.clubs.byId[state.participants[0]!.clubId]!;
    const initial = resolveLineup(state, club, 1);
    const starters = initial.map((entry) => entry.player!.id);
    const lateral = starters[1]!;
    [starters[1], starters[5]] = [starters[5]!, lateral];
    const player = { ...state.players.byId[lateral]!, name: 'Reinaldo', position: 'LB' as const };
    const saved = {
      ...state,
      players: { ...state.players, byId: { ...state.players.byId, [lateral]: player } },
      tactics: { ...state.tactics, [club.id]: { formation: '4-3-3' as const, starters } },
    };
    const entry = resolveLineup(saved, club, 1)[5]!;
    expect(entry.player?.id).toBe(lateral);
    expect(entry.position).toBe('CM');
    expect(entry.factor).toBeLessThan(1);
    expect(entry.effectiveOverall).toBeLessThan(player.overall);
    expect(canLearnPosition(player.position, entry.position)).toBe(false);
  });
  it.each([
    ['LW', 'LM'],
    ['RW', 'RM'],
    ['CM', 'DM'],
    ['CM', 'AM'],
    ['LB', 'LWB'],
    ['RB', 'RWB'],
    ['LWB', 'LM'],
    ['RWB', 'RM'],
    ['ST', 'SS'],
    ['SS', 'AM'],
    ['CB', 'DM'],
  ] as const)('suaviza funções vizinhas: %s → %s', (natural, assigned) => {
    expect(positionFactor(natural, assigned)).toBe(0.97);
  });

  it('considera a faixa do campo e mantém mudanças distantes', () => {
    expect(positionFactor('LW', 'ST')).toBe(0.94);
    expect(positionFactor('LW', 'LM')).toBeGreaterThan(positionFactor('LW', 'RM'));
    expect(positionFactor('LW', 'CB')).toBe(0.45);
    expect(positionFactor('LW', 'LB')).toBe(0.85);
    expect(positionFactor('GK', 'ST')).toBe(0.35);
  });

  it('reduz a perda também nas posições próximas fora da lista de aprendizado', () => {
    for (const [natural, assigned] of [
      ['CM', 'ST'],
      ['AM', 'ST'],
      ['CB', 'CM'],
      ['LB', 'CB'],
      ['RB', 'CB'],
    ] as const) {
      expect(positionFactor(natural, assigned)).toBeGreaterThanOrEqual(0.94);
      expect(positionFactor(assigned, natural)).toBe(positionFactor(natural, assigned));
    }
  });

  it('mantém limites e adaptação para todas as combinações', () => {
    for (const natural of positionSchema.options) {
      for (const assigned of positionSchema.options) {
        const base = positionFactor(natural, assigned);
        expect(base).toBeGreaterThanOrEqual(0.35);
        expect(base).toBeLessThanOrEqual(1);
        expect(positionFactor(natural, assigned, 7)).toBeGreaterThanOrEqual(base);
        if (canLearnPosition(natural, assigned))
          expect(positionFactor(natural, assigned, 15)).toBe(1);
      }
    }
  });
});
