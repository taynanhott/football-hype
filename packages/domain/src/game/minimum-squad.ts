import {
  MIN_SQUAD_SIZE,
  MONEY_STEPS,
  ceilMoney,
  positionSchema,
  type WorldState,
  type PlayerSnapshot,
} from '@football/shared';
import { prepareAcademy } from './academy.js';
import { averageMonthlySalary } from './player-contracts.js';
import { stableId } from './world-factory.js';
import { hashSeed, mulberry32 } from '../simulation/random.js';

/** Used only after an unavoidable contract departure, never to enable a sale. */
export function replenishMinimumSquad(
  state: WorldState,
  clubId: string,
  template: PlayerSnapshot,
): WorldState {
  let next = state;
  while (next.clubs.byId[clubId]!.playerIds.length < MIN_SQUAD_SIZE) {
    next = prepareAcademy(next, clubId);
    let prospect = Object.values(next.players.byId)
      .filter(
        (p) =>
          p.academyClubId === clubId &&
          p.academySeason === next.season &&
          p.clubId === null &&
          p.academyDismissedSeason === undefined &&
          p.academyPromotedSeason === undefined,
      )
      .sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))[0];
    if (!prospect) {
      let serial = next.players.ids.length;
      let id = stableId(84, hashSeed(next.seed, `${clubId}:${next.season}:${serial}`));
      while (next.players.byId[id])
        id = stableId(84, hashSeed(next.seed, `${clubId}:${next.season}:${++serial}`));
      const random = mulberry32(hashSeed(next.seed, id));
      const nationalities = [
        ...new Set(Object.values(next.players.byId).map((p) => p.nationality)),
      ].sort();
      const first = ['Lucas', 'Alex', 'Gabriel', 'Daniel', 'Nicolas', 'Samuel'];
      const last = ['Silva', 'Costa', 'Santos', 'Lima', 'Souza', 'Rocha'];
      prospect = {
        id,
        name: `${first[Math.floor(random() * first.length)]} ${last[Math.floor(random() * last.length)]}`,
        clubId: null,
        academyClubId: clubId,
        academySeason: next.season,
        age: 17,
        overall: 45,
        potential: 50,
        nationality:
          nationalities[Math.floor(random() * nationalities.length)] ?? template.nationality,
        position: positionSchema.options[Math.floor(random() * positionSchema.options.length)]!,
        shirtNumber: 1,
        appearances: 0,
        fitness: 100,
        morale: 80,
        appearance: { ...template.appearance, beardStyle: 'none' },
        salary: { ...template.salary, cents: averageMonthlySalary(45, 17) },
        // Twelve monthly wages, with the same age-sensitive wage benchmark used for promotion.
        marketValue: {
          ...template.marketValue,
          cents: ceilMoney(averageMonthlySalary(45, 17) * 12, MONEY_STEPS.transfer),
        },
      };
      next = {
        ...next,
        players: { ids: [...next.players.ids, id], byId: { ...next.players.byId, [id]: prospect } },
      };
    }
    const club = next.clubs.byId[clubId]!;
    const salary = averageMonthlySalary(prospect.overall, prospect.age);
    const shirtNumber =
      Array.from({ length: 99 }, (_, i) => i + 1).find(
        (number) => !club.playerIds.some((id) => next.players.byId[id]?.shirtNumber === number),
      ) ?? 99;
    next = {
      ...next,
      clubs: {
        ...next.clubs,
        byId: {
          ...next.clubs.byId,
          [clubId]: {
            ...club,
            playerIds: [...club.playerIds, prospect.id],
            balance: { ...club.balance, cents: Math.max(0, club.balance.cents - salary) },
          },
        },
      },
      debts: {
        ...next.debts,
        [clubId]: (next.debts[clubId] ?? 0) + Math.max(0, salary - club.balance.cents),
      },
      players: {
        ...next.players,
        byId: {
          ...next.players.byId,
          [prospect.id]: {
            ...prospect,
            clubId,
            academyPromotedSeason: next.season,
            salary: { ...prospect.salary, cents: salary },
            shirtNumber,
          },
        },
      },
      management: {
        ...next.management,
        contracts: {
          ...next.management?.contracts,
          [prospect.id]: next.lastProcessedAt + 3 * 365 * 86400000,
        },
        contractHistory: {
          ...next.management?.contractHistory,
          [prospect.id]: {
            overall: prospect.overall,
            marketValue: prospect.marketValue.cents,
            signedAt: next.lastProcessedAt,
            dissatisfied: false,
          },
        },
      },
    };
    next = prepareAcademy(next, clubId);
  }
  return next;
}
