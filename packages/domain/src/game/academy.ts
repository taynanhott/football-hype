import { stableId } from './world-factory.js';
import type { WorldState } from '@football/shared';

// A season starts with five places; only the first three promotions refill a place.
export function prepareAcademy(state: WorldState, clubId: string): WorldState {
  const club = state.clubs.byId[clubId];
  if (!club) return state;
  const all = Object.values(state.players.byId);
  const promoted = all.filter(
    (p) =>
      p.academyClubId === clubId &&
      (p.academyPromotedSeason === state.season || p.academyDismissedSeason === state.season),
  ).length;
  const listed = all.filter((p) => p.academyClubId === clubId && p.academySeason === state.season);
  const target = Math.max(0, 5 - Math.max(0, promoted - 3));
  const available = listed.filter((p) => !p.clubId && p.academyDismissedSeason === undefined);
  const byId = { ...state.players.byId };
  const ids = [...state.players.ids];
  const real = all
    .filter(
      (p) =>
        p.academyClubId === clubId &&
        !p.clubId &&
        p.academyDismissedSeason === undefined &&
        p.academySeason !== state.season,
    )
    .sort((a, b) => b.potential - a.potential || a.id.localeCompare(b.id));
  const template = all.find((p) => p.clubId === clubId);
  const level = state.centers.byId[club.trainingCenterId]?.levels.scouting ?? 1;
  for (let i = available.length; i < target; i++) {
    const serial = listed.length + i - available.length;
    // Include a generated prospect in each initial group, even with real youth available.
    const candidate = serial % 5 !== 4 ? real.shift() : undefined;
    if (candidate) {
      byId[candidate.id] = { ...candidate, academySeason: state.season };
      continue;
    }
    if (!template) continue;
    const id = stableId(
      83,
      state.season * 10000000 + state.clubs.ids.indexOf(clubId) * 1000 + serial,
    );
    let seed = Array.from(id).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17);
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const first = ['Lucas', 'Pedro', 'Rafael', 'João', 'Gabriel', 'Matheus', 'Caio', 'André'];
    const last = ['Silva', 'Santos', 'Oliveira', 'Lima', 'Costa', 'Almeida', 'Rocha', 'Souza'];
    const overall = 35 + Math.floor(random() * 21);
    const potential = Math.min(99, Math.max(overall, 48 + level * 6 + Math.floor(random() * 16)));
    byId[id] = {
      ...template,
      id,
      name: `${first[Math.floor(random() * first.length)]} ${last[Math.floor(random() * last.length)]}`,
      clubId: null,
      academyClubId: clubId,
      academySeason: state.season,
      age: 16 + Math.floor(random() * 4),
      overall,
      potential,
      position: (['GK', 'CB', 'LB', 'RB', 'CM', 'DM', 'AM', 'LW', 'RW', 'ST'] as const)[
        Math.floor(random() * 10)
      ]!,
      appearances: 0,
      fitness: 100,
      morale: 80,
      salary: { ...template.salary, cents: Math.round((500 + overall * 30) / 100) * 100 },
      marketValue: { ...template.marketValue, cents: overall * 100000 },
    };
    ids.push(id);
  }
  return { ...state, players: { ids, byId } };
}
