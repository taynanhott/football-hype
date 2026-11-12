import { describe, expect, it } from 'vitest';
import { worldStateSchema, type WorldState } from '@football/shared';
import fs from 'node:fs';
import {
  createWorld,
  stableId,
  accrueSponsorship,
  monthlySponsorship,
  sponsorshipContract,
} from '../src/index.js';
import { recordFinancialHistory } from '../src/finance/financial-management.js';
import { ECONOMY_BASELINES } from '../src/finance/economy-baselines.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const start = Date.UTC(2026, 0, 1, 3),
  end = Date.UTC(2026, 1, 1, 3);
const original = unwrap(
  createWorld({
    id: stableId(842, 1),
    userId: 'host',
    name: 'Contrato mensal',
    mode: 'offline',
    now: start,
  }),
);
const data = JSON.parse(fs.readFileSync('data/player-database.json', 'utf8'));
const state: WorldState = {
  ...original,
  ...data,
  fixtures: [],
  cups: [],
  results: [],
  lastProcessedAt: start,
};
const club = state.clubs.byId[state.clubs.ids[0]!]!;
describe('patrocínio mensal calibrado', () => {
  it('migra uma carreira sem os novos campos e mantém o estado válido', () => {
    const migrated = accrueSponsorship(original, original.lastProcessedAt + 86400000);
    expect(worldStateSchema.safeParse(migrated).success).toBe(true);
    expect(migrated.management?.sponsorshipAccruedThrough).toBe(
      original.lastProcessedAt + 86400000,
    );
    expect(accrueSponsorship(migrated, migrated.management!.sponsorshipAccruedThrough!)).toBe(
      migrated,
    );
  });
  it('paga o mês sem depender de rodadas, preserva centavos e não duplica no replay', () => {
    const monthly = monthlySponsorship(state, club, sponsorshipContract(state, '2026-01'));
    const direct = accrueSponsorship(state, end);
    expect(direct.clubs.byId[club.id]!.balance.cents - club.balance.cents).toBe(monthly);
    const split = accrueSponsorship(accrueSponsorship(state, start + 86400000 * 13), end);
    expect(split.clubs.byId[club.id]!.balance.cents).toBe(
      direct.clubs.byId[club.id]!.balance.cents,
    );
    expect(accrueSponsorship(direct, end)).toBe(direct);
    const booked = recordFinancialHistory(state, { ...direct, lastProcessedAt: end });
    const january = booked.management?.financialHistory?.find(
      (r) => r.clubId === club.id && r.month === '2026-01',
    );
    expect(january?.income).toBe(monthly);
    expect(
      booked.management?.financialHistory
        ?.filter((r) => r.clubId === club.id)
        .reduce((sum, r) => sum + r.income, 0),
    ).toBe(monthly);
  });
  it('não aumenta o contrato ao contratar jogadores ou expandir estruturas', () => {
    const contract = sponsorshipContract(state, '2026-01');
    const locked = {
      ...state,
      management: { ...state.management, monthlySponsorshipContract: contract },
    };
    const changed = {
      ...locked,
      players: {
        ...locked.players,
        byId: Object.fromEntries(
          Object.entries(locked.players.byId).map(([id, p]) => [
            id,
            { ...p, salary: { ...p.salary, cents: p.salary.cents * 5 } },
          ]),
        ),
      },
    };
    expect(sponsorshipContract(changed, '2026-01')).toBe(contract);
    expect(monthlySponsorship(changed, club, contract)).toBe(
      monthlySponsorship(locked, club, contract),
    );
  });
  it('preserva as metas por clube e divisão, inclusive em mês sem jogos', () => {
    const contract = sponsorshipContract(state, '2026-01');
    const totals = new Map<string, number[]>();
    for (const c of Object.values(state.clubs.byId)) {
      if (c.country !== 'BR' || !['A', 'B', 'C', 'D'].includes(c.division)) continue;
      const profile = ECONOMY_BASELINES[c.id]!;
      const terms = contract.clubs[c.id]!;
      expect(terms.normal - profile.cost).toBe(profile.targets[1]);
      const row = totals.get(c.division) ?? [0, 0];
      row[0]! += terms.normal - profile.cost;
      row[1]!++;
      totals.set(c.division, row);
    }
    for (const [division, target] of Object.entries({
      A: 1316500,
      B: 466500,
      C: 406000,
      D: 415200,
    })) {
      const row = totals.get(division)!;
      expect(Math.round(row[0]! / row[1]!)).toBeCloseTo(target, 0);
    }
  });
});
