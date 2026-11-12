import { describe, expect, it } from 'vitest';
import { worldStateSchema, type WorldState } from '@football/shared';
import { createWorld, advanceGameDays } from '../src/index.js';
import { finalizeMonthlyCoachAward } from '../src/competitions/monthly-coach-awards.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const boundary = Date.UTC(2026, 1, 1, 3);
function world() {
  const state = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Técnicos',
      mode: 'offline',
      now: Date.UTC(2026, 0, 1, 3),
    }),
  );
  state.lastProcessedAt = boundary - 86_400_000;
  state.fixtures = [];
  state.cups = [];
  state.results = [];
  state.competitionDraws = [];
  state.roundCalendarVersion = 1;
  state.roundDates = {};
  return state;
}
function games(
  state: WorldState,
  division: 'A' | 'B',
  goals = 2,
  conceded = 0,
  count = 3,
  month = 0,
  coachUserId?: string,
) {
  const clubs = Object.values(state.clubs.byId).filter(
    (c) => c.country === 'BR' && c.division === division,
  );
  const home = clubs[0]!,
    away = clubs[1]!;
  for (let i = 0; i < count; i++) {
    const id = `${division}:${month}:${i}`;
    state.fixtures.push({
      id,
      competitionId: `serie-${division.toLowerCase()}`,
      round: i,
      homeId: home.id,
      awayId: away.id,
      scheduledAt: Date.UTC(2026, month, 5 + i * 7, 19),
    });
    state.results.push({
      status: 'finished',
      fixtureId: id,
      homeGoals: goals,
      awayGoals: conceded,
      attendance: 0,
      revenue: 0,
      seed: i,
      scorers: [],
      ...(coachUserId ? { coachUserIds: { home: coachUserId } } : {}),
    });
  }
  return home.id;
}
describe('técnico do mês', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])(
    'entrega no dia 1 do mês de índice %i, pelo desempenho do mês anterior',
    (month) => {
      const state = world();
      games(state, 'A', 2, 0, 3, month - 1);
      const at = Date.UTC(2026, month, 1, 3);
      const award = finalizeMonthlyCoachAward(state, at).monthlyCoachAwards?.[0];
      expect(award?.awardedAt).toBe(at);
      expect(award?.month).toBe(`2026-${String(month).padStart(2, '0')}`);
      expect(finalizeMonthlyCoachAward(state, at + 86_400_000)).toBe(state);
    },
  );
  it('não entrega em janeiro, mesmo com partidas elegíveis em dezembro', () => {
    const state = world();
    games(state, 'A', 2, 0, 3, 11);
    const january = Date.UTC(2027, 0, 1, 3);
    state.lastProcessedAt = january - 86_400_000;
    expect(finalizeMonthlyCoachAward(state, january)).toBe(state);
    expect(advanceGameDays(state, january).monthlyCoachAwards).toEqual(state.monthlyCoachAwards);
  });
  it('usa o peso das ligas, sem substituir desempenho por prestígio', () => {
    const state = world();
    const a = games(state, 'A'),
      b = games(state, 'B');
    expect(finalizeMonthlyCoachAward(state, boundary).monthlyCoachAwards?.[0]?.clubId).toBe(a);
    const strongerB = {
      ...state,
      results: state.results.map((r) =>
        r.fixtureId.startsWith('A:') ? { ...r, homeGoals: 0, awayGoals: 0 } : r,
      ),
    };
    expect(finalizeMonthlyCoachAward(strongerB, boundary).monthlyCoachAwards?.[0]?.clubId).toBe(b);
  });
  it('fecha à meia-noite de Brasília, sem incluir jogos do mês seguinte nem duplicados', () => {
    const state = world();
    games(state, 'A');
    state.fixtures[2] = { ...state.fixtures[2]!, scheduledAt: boundary - 1 };
    state.results.push(state.results[0]!);
    expect(finalizeMonthlyCoachAward(state, boundary - 1)).toBe(state);
    expect(finalizeMonthlyCoachAward(state, boundary).monthlyCoachAwards?.[0]?.games).toBe(3);
    state.fixtures[2] = { ...state.fixtures[2]!, scheduledAt: boundary };
    expect(finalizeMonthlyCoachAward(state, boundary)).toBe(state);
  });
  it('exige três jogos concluídos e ignora jogos sem data verificável', () => {
    const state = world();
    games(state, 'A');
    state.results[2] = { ...state.results[2]!, status: 'scheduled' };
    expect(finalizeMonthlyCoachAward(state, boundary)).toBe(state);
    state.results[2] = { ...state.results[2]!, status: 'finished', fixtureId: 'unknown' };
    expect(finalizeMonthlyCoachAward(state, boundary)).toBe(state);
  });
  it('persiste uma vez, preserva finanças, valida carreiras antigas e mantém o histórico', () => {
    const state = world();
    games(state, 'A', 2, 0, 3, 0, IDS.user);
    const awarded = finalizeMonthlyCoachAward(state, boundary);
    expect(awarded.monthlyCoachAwards?.[0]?.coachUserId).toBe(IDS.user);
    expect(awarded.clubs).toBe(state.clubs);
    expect(awarded.debts).toBe(state.debts);
    expect(awarded.seasonAwards).toBe(state.seasonAwards);
    expect(finalizeMonthlyCoachAward(awarded, boundary)).toBe(awarded);
    const restored = worldStateSchema.parse(JSON.parse(JSON.stringify(awarded)));
    expect(finalizeMonthlyCoachAward(restored, boundary)).toBe(restored);
    expect(worldStateSchema.safeParse(state).success).toBe(true);
    games(awarded, 'B', 2, 0, 3, 1);
    const next = finalizeMonthlyCoachAward(awarded, Date.UTC(2026, 2, 1, 3));
    expect(next.monthlyCoachAwards?.map((a) => a.month)).toEqual(['2026-01', '2026-02']);
  });
  it('não atribui partidas antigas ao treinador atual do clube', () => {
    const state = world();
    const clubId = games(state, 'A');
    state.participants = [{ ...state.participants[0]!, clubId }];
    const award = finalizeMonthlyCoachAward(state, boundary).monthlyCoachAwards?.[0];
    expect(award?.clubId).toBe(clubId);
    expect(award?.coachUserId).toBeUndefined();
  });
  it('é executado pelo avanço do calendário e não se repete ao reconectar', () => {
    const state = world();
    games(state, 'A');
    const next = advanceGameDays(state, boundary);
    expect(next.monthlyCoachAwards).toHaveLength(1);
    expect(advanceGameDays(next, boundary).monthlyCoachAwards).toEqual(next.monthlyCoachAwards);
  });
  it('preserva os vencedores de cada mês ao saltar vários meses', () => {
    const state = world();
    games(state, 'A');
    games(state, 'B', 2, 0, 3, 1);
    const march = Date.UTC(2026, 2, 1, 3);
    const jumped = advanceGameDays(state, march);
    const stepped = advanceGameDays(advanceGameDays(state, boundary), march);
    expect(jumped.monthlyCoachAwards?.map((a) => a.month)).toEqual(['2026-01', '2026-02']);
    expect(jumped.monthlyCoachAwards).toEqual(stepped.monthlyCoachAwards);
  });
});
