import { describe, expect, it } from 'vitest';
import {
  stableId,
  createWorld,
  transferContext,
  signingSalary,
  executeCommand,
  applyEvent,
} from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

describe('salário por duração na contratação', () => {
  it('aumenta a pedida de 5% em 5% sem juros compostos', () => {
    expect([1, 2, 3, 4, 5].map((years) => signingSalary(400000, years))).toEqual([
      400000, 420000, 440000, 460000, 480000,
    ]);
  });
  it('recalcula contrapropostas pela base ao trocar anos e não acumula aumentos', () => {
    let state = unwrap(
      createWorld({
        id: IDS.league,
        userId: IDS.user,
        name: 'Contrato',
        mode: 'offline',
        now: Date.parse('2026-01-15T15:00:00Z'),
      }),
    );
    const club = state.clubs.byId[state.participants[0]!.clubId]!;
    const player = Object.values(state.players.byId).find((p) => p.clubId === null)!;
    const base = transferContext(state, player, club).minimumSalary;
    for (const years of [5, 5, 1, 4]) {
      const command = { type: 'sign-free' as const, playerId: player.id, salary: 0, years };
      state = unwrap(
        applyEvent(
          state,
          unwrap(
            executeCommand(
              state,
              command,
              IDS.user,
              state.lastProcessedAt,
              stableId(95, state.revision + 1),
            ),
          ),
        ),
      );
      expect(state.negotiations.at(-1)?.minimumSalary).toBe(signingSalary(base, years));
      expect(state.negotiations.at(-1)?.baseMinimumSalary).toBe(base);
    }
    const salary = signingSalary(base, 4);
    state = unwrap(
      applyEvent(
        state,
        unwrap(
          executeCommand(
            state,
            { type: 'sign-free', playerId: player.id, salary, years: 4 },
            IDS.user,
            state.lastProcessedAt,
            stableId(95, state.revision + 1),
          ),
        ),
      ),
    );
    expect(state.players.byId[player.id]?.salary.cents).toBe(salary);
    expect(state.management?.contracts?.[player.id]).toBe(
      state.lastProcessedAt + 4 * 365 * 86400000,
    );
  });
});
