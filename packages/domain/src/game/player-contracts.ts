import { careerAmbition } from './career-ambition.js';
import { clubResults, playerRatings } from './history-index.js';
import { ceilMoney, MONEY_STEPS, type PlayerSnapshot, type WorldState } from '@football/shared';
const DAY = 86400000;
export function signingSalary(base: number, years: number): number {
  const duration = Math.max(1, Math.min(5, Math.floor(years)));
  return ceilMoney(Math.ceil((base * (100 + (duration - 1) * 5)) / 100), MONEY_STEPS.salary);
}
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
/** Monthly benchmark in cents; independent of current salary and slider limits. */
export function averageMonthlySalary(overall: number, age: number): number {
  const rating = Math.max(40, Math.min(99, overall));
  const ageFactor =
    age < 24
      ? 0.8 + Math.max(0, age - 18) / 30
      : age <= 29
        ? 1
        : Math.max(0.55, 1 - (age - 29) * 0.055);
  return ceilMoney(600000 * Math.pow(3, (rating - 70) / 10) * ageFactor, MONEY_STEPS.salary);
}
export function renewalPatience(player: PlayerSnapshot) {
  const seed = player.id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return { refusals: 2 + (seed % 2), retryDays: seed % 2 ? 14 : 7 };
}
export function refusesForPlayingTime(state: WorldState, player: PlayerSnapshot) {
  const games = player.clubId ? clubResults(state, player.clubId) : [];
  const baseline = state.management?.contractHistory?.[player.id]?.effectsClubGames ?? 0;
  const recent = games
    .slice(baseline)
    .filter((game) => game.lineups)
    .slice(-(player.age <= 23 ? 12 : 8));
  return (
    recent.length >= (player.age <= 23 ? 12 : 8) &&
    recent.every(
      (game) => !game.lineups?.home.includes(player.id) && !game.lineups?.away.includes(player.id),
    ) &&
    player.overall >= 60
  );
}
function renewalRequest(state: WorldState, player: PlayerSnapshot) {
  const record = state.management?.contractHistory?.[player.id];
  if (
    !record ||
    record.refusesRenewal ||
    record.severeDissatisfaction ||
    state.management?.loans?.[player.id]
  )
    return null;
  if (
    record.dissatisfied &&
    (!record.nextRequestAt || state.lastProcessedAt < record.nextRequestAt)
  )
    return null;
  const remaining = Math.ceil((contractExpires(state, player) - state.lastProcessedAt) / DAY);
  if (remaining <= 180 && refusesForPlayingTime(state, player)) return null;
  if (record.nextRequestAt && state.lastProcessedAt >= record.nextRequestAt)
    return {
      reason: remaining <= 180 ? ('expiring' as const) : ('growth' as const),
      due: record.nextRequestAt,
    };
  if (remaining > maxContractYears(player.age) * 365) return null;
  const signedAt = record.signedAt || state.createdAt;
  if (record.signedAt && state.lastProcessedAt - signedAt < 180 * DAY) return null;
  if (state.lastProcessedAt - signedAt < 14 * DAY && remaining > 30) return null;
  const stagger =
    player.id.split('').reduce((sum, character) => sum + character.charCodeAt(0), 0) % 61;
  if (remaining <= 180 - stagger)
    return {
      reason: 'expiring' as const,
      due: contractExpires(state, player) - (180 - stagger) * DAY,
    };
  const largeGrowth =
    player.marketValue.cents >= Math.max(1, record.marketValue) * 1.65 ||
    (player.overall >= record.overall + 3 &&
      player.marketValue.cents >= Math.max(1, record.marketValue) * 1.4);
  if (largeGrowth && averageMonthlySalary(player.overall, player.age) > player.salary.cents * 1.15)
    return { reason: 'growth' as const, due: signedAt + 180 * DAY };
  return null;
}
export function renewalTerms(state: WorldState, player: PlayerSnapshot, years = 1) {
  const record = state.management?.contractHistory?.[player.id];
  const remaining = Math.ceil((contractExpires(state, player) - state.lastProcessedAt) / DAY);
  const history = (player.clubId ? clubResults(state, player.clubId) : []).slice(-5);
  const team = history.reduce((sum, r) => {
    const diff = r.homeId === player.clubId ? r.homeGoals - r.awayGoals : r.awayGoals - r.homeGoals;
    return sum + (diff > 0 ? 2 : diff < 0 ? -2 : -1);
  }, 0);
  const ratings = playerRatings(state, player.id).slice(-5);
  const individual = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length - 6.5) * 4
    : 0;
  const sequence = Math.min(5, state.workload[player.id]?.consecutiveMatches ?? 0);
  const morale = Math.max(
    0,
    Math.min(100, player.morale + (team + individual + sequence) * moraleSensitivity(player)),
  );
  const averageSalary = averageMonthlySalary(player.overall, player.age);
  const request = renewalRequest(state, player);
  // A club receives at most two simultaneous requests; oldest requests take priority.
  const queue =
    request && player.clubId
      ? (state.clubs.byId[player.clubId]?.playerIds ?? [])
          .flatMap((id) => {
            const member = state.players.byId[id];
            const candidate = member ? renewalRequest(state, member) : null;
            return candidate ? [{ id, due: candidate.due }] : [];
          })
          .sort((a, b) => a.due - b.due || a.id.localeCompare(b.id))
          .slice(0, 2)
      : [];
  const demand = Boolean(request && queue.some((item) => item.id === player.id));
  const shortContractDiscount = 0.96 + (Math.max(1, Math.min(5, years)) - 1) * 0.01;
  const senior = player.age >= 32;
  const baseline = demand
    ? averageSalary
    : senior && remaining <= 180
      ? Math.max(player.salary.cents * 0.65, averageSalary * 0.95)
      : Math.max(player.salary.cents * (senior ? 1 : 0.9), averageSalary);
  const minimumSalary = ceilMoney(baseline * shortContractDiscount, MONEY_STEPS.salary);
  const recent = record && state.lastProcessedAt - record.signedAt < 180 * DAY;
  const reason =
    record?.refusesRenewal || (remaining <= 180 && refusesForPlayingTime(state, player))
      ? 'O jogador decidiu não renovar. Ele pode ser vendido ou sairá livre ao fim do contrato.'
      : careerAmbition(state, player) >= 60
        ? 'O jogador busca uma liga mais forte para continuar a carreira e não deseja renovar neste momento.'
        : state.management?.loans?.[player.id]
          ? 'Jogador emprestado: a renovação será tratada no clube de origem.'
          : recent
            ? 'Contrato renovado recentemente. O jogador não quer renegociar agora.'
            : remaining > 180 && !demand && !record?.severeDissatisfaction
              ? 'A renegociação voluntária só pode ocorrer nos últimos seis meses do contrato.'
              : morale < 30
                ? 'Moral baixa: o jogador não quer renovar.'
                : '';
  return {
    morale: Math.round(morale),
    remaining,
    minimumSalary,
    averageSalary,
    demandReason: demand ? request?.reason : undefined,
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
