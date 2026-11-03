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
  situation?: string;
  position?: string;
  continent?: string;
  salary?: number[];
  interestedPlayers: boolean;
  interestedClubs: boolean;
};
export function defaultMarketFilters(): MarketFilterValues {
  return {
    situation: 'all',
    position: 'ALL',
    continent: 'all',
    salary: [0, UNLIMITED_MARKET_PRICE],
    overall: [1, 99],
    age: [16, 45],
    price: [0, UNLIMITED_MARKET_PRICE],
    interestedPlayers: false,
    interestedClubs: false,
  };
}

export function countryContinent(country: string) {
  const groups: Record<string, string> = {
    south: 'BR AR UY PY CL CO EC PE BO VE GF',
    north: 'US CA MX CR PA HN GT SV NI DO HT JM PR CU TT CW GP MQ SR',
    europe:
      'GB PT ES FR DE IT NL BE DK SE NO FI IS IE AT CH PL CZ SK SI HR RS BA AL ME XK GR RO BG HU UA RU EE LV LT LU MT CY FO MD',
    africa:
      'MA DZ TN EG ZA NG GH CI CM SN ML GN CG CD AO CV BF TG GA BJ GW GQ MR NE LR SL KE UG ZM ZW TZ MZ CF TD GM',
    asia: 'SA AE QA TR IL IQ IR SY JO PS LB AM AZ GE KZ UZ TJ IN BD CN JP KR MY PH TH VN ID SG',
    oceania: 'AU NZ',
  };
  return Object.keys(groups).find((key) => groups[key]!.split(' ').includes(country)) ?? 'other';
}
