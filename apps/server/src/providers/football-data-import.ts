import { z } from 'zod';
import { createWorld, seasonSchedule, stableId } from '@football/domain';
import {
  worldDatasetSchema,
  kitFromClubColors,
  type PlayerSnapshot,
  type WorldDataset,
} from '@football/shared';

const personSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  position: z.string().nullish(),
  dateOfBirth: z.iso.date().nullish(),
  nationality: z.string().nullish(),
});
export const footballTeamsSchema = z.object({
  teams: z
    .array(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1),
        tla: z.string().nullish(),
        crest: z.url().nullish(),
        venue: z.string().nullish(),
        clubColors: z.string().nullish(),
        squad: z.array(personSchema),
      }),
    )
    .length(20),
});
const positions: Record<string, PlayerSnapshot['position']> = {
  Goalkeeper: 'GK',
  Defence: 'CB',
  'Centre-Back': 'CB',
  'Left-Back': 'LB',
  'Right-Back': 'RB',
  Midfield: 'CM',
  'Central Midfield': 'CM',
  'Defensive Midfield': 'DM',
  'Attacking Midfield': 'AM',
  Offence: 'ST',
  'Centre-Forward': 'ST',
  'Left Winger': 'LW',
  'Right Winger': 'RW',
};
const regions = new Intl.DisplayNames(['en'], { type: 'region' });
const countries = new Map<string, string>();
for (let first = 65; first <= 90; first++)
  for (let second = 65; second <= 90; second++) {
    const code = String.fromCharCode(first, second);
    const name = regions.of(code);
    if (name && name !== code) countries.set(name, code);
  }
for (const [name, code] of Object.entries({
  England: 'GB',
  Scotland: 'GB',
  Wales: 'GB',
  'Northern Ireland': 'GB',
  'DR Congo': 'CD',
}))
  countries.set(name, code);
const normalized = <T extends { id: string }>(values: T[]) => ({
  ids: values.map((value) => value.id),
  byId: Object.fromEntries(values.map((value) => [value.id, value])),
});

export function convertFootballData(
  input: unknown,
  now: number,
  currentTeams: ReadonlyMap<number, number> = new Map(),
): { dataset: WorldDataset; excluded: string[] } {
  const data = footballTeamsSchema.parse(input);
  const generated = createWorld({
    id: stableId(90, 1),
    userId: 'data-import',
    name: 'Base real',
    mode: 'offline',
    now,
  });
  if (!generated.ok) throw new Error(generated.error.message);
  const world = generated.value;
  const templates = Object.values(world.players.byId);
  const clubs = [],
    players: PlayerSnapshot[] = [],
    stadiums = [],
    centers = [],
    excluded: string[] = [];
  const owners = new Set<number>();
  for (const [index, team] of data.teams.entries()) {
    const template = world.clubs.byId[world.clubs.ids[index] ?? ''];
    const stadium = template ? world.stadiums.byId[template.stadiumId] : undefined;
    const center = template ? world.centers.byId[template.trainingCenterId] : undefined;
    if (!template || !stadium || !center) throw new Error('Modelo de clube ausente');
    const id = stableId(11, team.id),
      stadiumId = stableId(13, team.id),
      trainingCenterId = stableId(14, team.id);
    const roster: PlayerSnapshot[] = [];
    for (const person of team.squad) {
      if (currentTeams.has(person.id) && currentTeams.get(person.id) !== team.id) continue;
      if (owners.has(person.id))
        throw new Error(`Vínculo duplicado sem confirmação: ${person.name}`);
      const position = person.position ? positions[person.position] : undefined;
      const nationality = person.nationality ? countries.get(person.nationality) : undefined;
      if (!position || !person.dateOfBirth || !nationality) {
        excluded.push(`${person.name}: cadastro incompleto`);
        continue;
      }
      const born = new Date(person.dateOfBirth),
        current = new Date(now);
      const birthdayPending =
        current.getUTCMonth() < born.getUTCMonth() ||
        (current.getUTCMonth() === born.getUTCMonth() && current.getUTCDate() < born.getUTCDate());
      const age = current.getUTCFullYear() - born.getUTCFullYear() - Number(birthdayPending);
      if (age < 16 || age > 100) {
        excluded.push(`${person.name}: idade fora dos limites do jogo`);
        continue;
      }
      const base = templates[person.id % templates.length];
      if (!base) throw new Error('Modelo de atleta ausente');
      owners.add(person.id);
      roster.push({
        ...base,
        id: stableId(12, person.id),
        clubId: id,
        name: person.name,
        nationality,
        position,
        age,
        shirtNumber: roster.length + 1,
        appearances: 0,
      });
    }
    if (roster.length < 11 || !roster.some((player) => player.position === 'GK'))
      throw new Error(`Elenco insuficiente: ${team.name}`);
    players.push(...roster);
    // Relative starting conditions for gameplay, not audited financial accounts.
    const normalizedName = team.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const wealth = /flamengo|palmeiras|botafogo/.test(normalizedName)
      ? 5
      : /corinthians|sao paulo|atletico mineiro|fluminense|cruzeiro|internacional|gremio/.test(
            normalizedName,
          )
        ? 4
        : /santos|vasco|bahia|fortaleza|athletico/.test(normalizedName)
          ? 3
          : 2;
    const level = Math.min(4, wealth);
    clubs.push({
      ...template,
      id,
      name: team.name,
      kit: kitFromClubColors(team.name, team.clubColors),
      balance: { cents: 100000000 * wealth * wealth, currency: 'BRL' as const },
      ...(team.crest ? { crestUrl: team.crest } : {}),
      abbreviation: team.tla?.slice(0, 5) || team.name.slice(0, 3).toUpperCase(),
      stadiumId,
      trainingCenterId,
      playerIds: roster.map((player) => player.id),
    });
    stadiums.push({
      ...stadium,
      id: stadiumId,
      clubId: id,
      name: team.venue || `Estádio ${team.name}`,
      pitchLevel: level,
      surroundingsLevel: level,
      sectors: stadium.sectors.map((sector) => ({ ...sector, level, capacity: 1800 * wealth })),
      commerce: { foodLevel: level, shirtsLevel: level, hospitalityLevel: level },
    });
    centers.push({
      ...center,
      id: trainingCenterId,
      clubId: id,
      levels: {
        fitness: level,
        medical: level,
        scouting: level,
        coaching: level,
        marketing: level,
      },
    });
  }
  const schedule = seasonSchedule(clubs, now);
  return {
    dataset: worldDatasetSchema.parse({
      clubs: normalized(clubs),
      players: normalized(players),
      stadiums: normalized(stadiums),
      centers: normalized(centers),
      fixtures: schedule.fixtures,
      source: `Football data provided by the Football-Data.org API · BSA · ${new Date(now).toISOString().slice(0, 10)}`,
      license:
        'football-data.org/terms-conditions. Nomes, vínculos, idades e posições vêm do provedor. Overall, potencial, salários, valores, números de camisa, aparência e estruturas são parâmetros de jogo (perfis econômicos relativos estimados), não dados oficiais. Calendário simulado. Cadastros incompletos são excluídos.',
    }),
    excluded,
  };
}
