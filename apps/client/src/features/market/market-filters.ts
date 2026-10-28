import type { PlayerSnapshot } from '@football/shared';

export const UNLIMITED_MARKET_PRICE = Number.MAX_SAFE_INTEGER;
export function marketPriceCeiling(players: readonly PlayerSnapshot[]) {
  const largest = players.reduce((max, player) => Math.max(max, player.marketValue.cents / 100), 0);
  return Math.max(100000, Math.ceil(largest / 100000) * 100000);
}
export function matchesMarketRanges(
  player: PlayerSnapshot,
  overall: readonly number[],
  age: readonly number[],
  price: readonly number[],
) {
  return (
    player.overall >= overall[0]! &&
    player.overall <= overall[1]! &&
    player.age >= age[0]! &&
    player.age <= age[1]! &&
    player.marketValue.cents / 100 >= price[0]! &&
    player.marketValue.cents / 100 <= price[1]!
  );
}

export type MarketFilterValues = {
  overall: number[];
  age: number[];
  price: number[];
  interestedPlayers: boolean;
  interestedClubs: boolean;
};
export function defaultMarketFilters(): MarketFilterValues {
  return {
    overall: [1, 99],
    age: [16, 45],
    price: [0, UNLIMITED_MARKET_PRICE],
    interestedPlayers: false,
    interestedClubs: false,
  };
}
