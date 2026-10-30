import { ceilMoney, MONEY_STEPS, type PlayerSnapshot, type WorldState } from '@football/shared';
const DAY = 86400000;
export function contractExpires(state: WorldState, player: PlayerSnapshot) {
  return (
    state.management?.contracts?.[player.id] ??
    state.createdAt +
      (1 + (player.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 3)) * 365 * DAY
  );
}
export const ageFatigueFactor = (age: number) =>
  Math.max(0.8, Math.min(1.6, 0.8 + Math.max(0, age - 20) * 0.025 + Math.max(0, age - 30) * 0.025));
export const moraleSensitivity = (player: PlayerSnapshot) =>
  player.age <= 23 && player.overall < 75 ? 0.15 : 1;
export const maxContractYears = (age: number) => (age >= 35 ? 1 : age >= 32 ? 2 : 5);
export function renewalTerms(state: WorldState, player: PlayerSnapshot) {
  const record = state.management?.contractHistory?.[player.id];
  const remaining = Math.ceil((contractExpires(state, player) - state.lastProcessedAt) / DAY);
  const history = state.results
    .filter((r) => r.homeId === player.clubId || r.awayId === player.clubId)
    .slice(-5);
  const team = history.reduce((sum, r) => {
    const diff = r.homeId === player.clubId ? r.homeGoals - r.awayGoals : r.awayGoals - r.homeGoals;
    return sum + (diff > 0 ? 2 : diff < 0 ? -2 : -1);
  }, 0);
  const ratings = state.ratingHistory.filter((r) => r.playerId === player.id).slice(-5);
  const individual = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length - 6.5) * 4
    : 0;
  const sequence = Math.min(5, state.workload[player.id]?.consecutiveMatches ?? 0);
  const morale = Math.max(
    0,
    Math.min(100, player.morale + (team + individual + sequence) * moraleSensitivity(player)),
  );
  const marketSalary = ceilMoney(player.marketValue.cents / 240, MONEY_STEPS.salary);
  const demand = Boolean(
    record &&
    player.overall >= record.overall + 3 &&
    player.marketValue.cents >= record.marketValue * 1.4 &&
    marketSalary > player.salary.cents * 1.5,
  );
  const minimumSalary = ceilMoney(
    demand
      ? Math.max(player.salary.cents * 1.25, marketSalary)
      : player.age >= 32 && remaining <= 180
        ? Math.max(player.salary.cents * 0.75, marketSalary * 0.6)
        : Math.max(player.salary.cents, Math.min(player.salary.cents * 3, marketSalary)),
    MONEY_STEPS.salary,
  );
  const recent = record && state.lastProcessedAt - record.signedAt < 180 * DAY;
  const reason = recent
    ? 'Contrato renovado recentemente. O jogador não quer renegociar agora.'
    : remaining > 730 && !demand
      ? 'O jogador tem mais de dois anos de contrato e não quer renegociar.'
      : morale < 30
        ? 'Moral baixa: o jogador não quer renovar.'
        : '';
  return {
    morale: Math.round(morale),
    remaining,
    minimumSalary,
    demand,
    maxYears: maxContractYears(player.age),
    reason,
  };
}
export function initializeContractHistory(state: WorldState): WorldState {
  if (
    Object.values(state.players.byId).every(
      (player) => state.management?.contractHistory?.[player.id],
    )
  )
    return state;
  const records = { ...state.management?.contractHistory };
  for (const player of Object.values(state.players.byId))
    if (!records[player.id])
      records[player.id] = {
        overall: player.overall,
        marketValue: player.marketValue.cents,
        signedAt: 0,
        dissatisfied: false,
      };
  return { ...state, management: { ...state.management, contractHistory: records } };
}
