import {
  fixedCupParticipants,
  shuffleCupParticipants,
} from '../competitions/fixed-participants.js';
import {
  seasonStart,
  competitionDates,
  SEASON_CALENDAR_VERSION,
} from '../competitions/season-calendar.js';
import { nextRealMatchTime } from './season-clock.js';
import { initializeStartingChemistry } from './tactics.js';
import { mapResult } from '../core/result.js';
import {
  COMPETITIONS,
  CUP_PARTICIPANTS_2026,
  competitionClubKey,
  knockoutLegs,
  clubKit,
  GAMEPLAY,
  worldStateSchema,
  type ClubSnapshot,
  type CupNode,
  type Fixture,
  type PlayerSnapshot,
  type StadiumSnapshot,
  type TrainingCenterSnapshot,
  type WorldState,
} from '@football/shared';
import { roundRobin } from '../competitions/round-robin.js';
import { groupFixtures } from '../competitions/cup-groups.js';
import { buildBracket } from '../competitions/knockout.js';

import { mulberry32 } from '../simulation/random.js';
import { BRAZIL_LEAGUE_STRENGTH } from '../market/interest.js';
import { parseBoundary } from '../core/validation.js';
import type { Result } from '../core/result.js';

export function stableId(namespace: number, index: number): string {
  return `${namespace.toString(16).padStart(8, '0')}-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}
function normalize<T extends { id: string }>(entities: readonly T[]) {
  return {
    ids: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
  };
}
const CLUB_NAMES = [
  'Aurora',
  'Atlético do Vale',
  'Ferroviário da Serra',
  'União Litorânea',
  'Estrela Azul',
  'Imperial',
  'Horizonte',
  'Rio Dourado',
  'Porto Real',
  'Nacional das Águas',
  'Vila Nova do Sol',
  'Operário Central',
  'Lagoa Esporte',
  'Montanha',
  'São Vicente do Campo',
  'Bela Vista',
  'Atlético das Palmeiras',
  'Cruzeiro do Norte',
  'Real Cerrado',
  'Juventude da Mata',
];
const FIRST_NAMES = [
  'Caio',
  'Rafael',
  'Lucas',
  'Mateus',
  'Davi',
  'Gabriel',
  'Pedro',
  'Bruno',
  'Thiago',
  'André',
  'Vinícius',
  'João',
  'Diego',
  'Felipe',
  'Luan',
  'Eduardo',
];
const LAST_NAMES = [
  'Aurélio',
  'Tavares',
  'Farias',
  'Moraes',
  'Siqueira',
  'Borges',
  'Vilar',
  'Nunes',
  'Barros',
  'Freitas',
  'Lacerda',
  'Duarte',
  'Reis',
  'Cavalcante',
  'Campos',
  'Peixoto',
];
const POSITIONS = [
  'GK',
  'GK',
  'CB',
  'CB',
  'CB',
  'LB',
  'RB',
  'DM',
  'CM',
  'CM',
  'AM',
  'LW',
  'RW',
  'ST',
  'ST',
  'ST',
] as const;
const SKIN_TONES = ['#533422', '#8a5738', '#b27b50', '#d6a77c', '#efc7a0'];

export function createWorld(input: {
  id: string;
  userId: string;
  name: string;
  mode: 'offline' | 'multiplayer';
  now: number;
  seed?: number;
  clubId?: string;
}): Result<WorldState> {
  const seed = input.seed ?? GAMEPLAY.seed;
  const random = mulberry32(seed);
  const clubs: ClubSnapshot[] = [];
  const players: PlayerSnapshot[] = [];
  const stadiums: StadiumSnapshot[] = [];
  const centers: TrainingCenterSnapshot[] = [];
  let clubIndex = 0;
  for (const [divisionIndex, division] of (['A', 'B', 'C', 'D'] as const).entries()) {
    const count = COMPETITIONS.find((rule) => rule.division === division)?.teamCount ?? 16;
    for (let index = 0; index < count; index++, clubIndex++) {
      const id = stableId(1, clubIndex + 1);
      const playerIds: string[] = [];
      for (let slot = 0; slot < GAMEPLAY.rosterSize; slot++) {
        const playerIndex = clubIndex * GAMEPLAY.rosterSize + slot;
        const player = fictionalPlayer(playerIndex, id, slot, divisionIndex, random);
        players.push(player);
        playerIds.push(player.id);
      }
      const stadiumId = stableId(3, clubIndex + 1);
      const trainingCenterId = stableId(4, clubIndex + 1);
      clubs.push({
        id,
        name: `${CLUB_NAMES[index % CLUB_NAMES.length]} ${division === 'A' ? 'FC' : division}`,
        kit: clubKit({
          name: `${CLUB_NAMES[index % CLUB_NAMES.length]} ${division === 'A' ? 'FC' : division}`,
        }),
        abbreviation: `A${clubIndex + 1}`,
        country: 'BR',
        division,
        leagueStrength: BRAZIL_LEAGUE_STRENGTH[division],
        balance: {
          cents: Math.round(GAMEPLAY.startingBalance / (divisionIndex + 1)),
          currency: 'BRL',
        },
        playerIds,
        stadiumId,
        trainingCenterId,
      });
      stadiums.push({
        id: stadiumId,
        clubId: id,
        name: `Arena ${CLUB_NAMES[index % CLUB_NAMES.length]}`,
        pitchLevel: Math.max(1, 4 - divisionIndex),
        surroundingsLevel: Math.max(1, 3 - divisionIndex),
        sectors: (['north', 'south', 'east', 'west'] as const).map((sector) => ({
          id: sector,
          level: Math.max(1, 3 - divisionIndex),
          capacity: GAMEPLAY.baseCapacity * (4 - divisionIndex),
        })),
        commerce: { foodLevel: 1, shirtsLevel: 1, hospitalityLevel: 1 },
      });
      centers.push({
        id: trainingCenterId,
        clubId: id,
        levels: {
          fitness: Math.max(1, 4 - divisionIndex),
          medical: Math.max(1, 3 - divisionIndex),
          scouting: Math.max(1, 3 - divisionIndex),
          coaching: Math.max(1, 3 - divisionIndex),
          marketing: Math.max(1, 4 - divisionIndex),
        },
      });
    }
  }
  const internationalCountries = [
    ...Array.from(
      { length: 20 },
      (_, index) => ['AR', 'UY', 'CL', 'CO', 'EC', 'PY', 'BO', 'VE'][index % 8] ?? 'AR',
    ),
    'GB',
    'ES',
    'DE',
    'IT',
    'FR',
    'PT',
    'NL',
    'BE',
  ];
  for (const [index, country] of internationalCountries.entries()) {
    const id = stableId(1, clubIndex + 1);
    const stadiumId = stableId(3, clubIndex + 1);
    const trainingCenterId = stableId(4, clubIndex + 1);
    const name = `${['Atlético del Puerto', 'Unión del Sur', 'Deportivo Cumbre', 'Real Bahía', 'Sporting del Valle', 'Club Andino', 'Ferro del Río'][index % 7]} ${country} ${index + 1}`;
    const squad = Array.from({ length: GAMEPLAY.rosterSize }, (_, slot) => ({
      ...fictionalPlayer(
        clubIndex * GAMEPLAY.rosterSize + slot,
        id,
        slot,
        index >= 20 ? -1 : 0,
        random,
      ),
      nationality: country,
    }));
    players.push(...squad);
    clubs.push({
      id,
      name,
      kit: clubKit({ name }),
      abbreviation: `I${index + 1}`,
      country,
      division: 'REGIONAL',
      leagueStrength: index >= 20 ? 95 : 75,
      balance: { cents: GAMEPLAY.startingBalance * 2, currency: 'BRL' },
      playerIds: squad.map((player) => player.id),
      stadiumId,
      trainingCenterId,
    });
    const stadium = stadiums[0];
    const center = centers[0];
    if (stadium && center) {
      stadiums.push({ ...stadium, id: stadiumId, clubId: id, name: `Arena ${name}` });
      centers.push({ ...center, id: trainingCenterId, clubId: id });
    }
    clubIndex++;
  }
  for (let index = 0; index < 48; index++) {
    const player = fictionalPlayer(2000 + index, null, index % GAMEPLAY.rosterSize, -1, random);
    players.push({
      ...player,
      nationality: ['AR', 'UY', 'PT', 'ES', 'FR', 'GB', 'DE', 'IT'][index % 8] ?? 'BR',
    });
  }
  const ownClub =
    clubs.find((club) => club.id === input.clubId && club.country === 'BR') ?? clubs[0];
  if (!ownClub) return parseBoundary(worldStateSchema, null);
  const initialDate = seasonStart(new Date(input.now).getUTCFullYear());
  const schedule = seasonSchedule(clubs, initialDate, undefined, seed);
  return mapResult(
    parseBoundary(worldStateSchema, {
      id: input.id,
      name: input.name,
      mode: input.mode,
      administratorId: input.userId,
      seed,
      season: new Date(input.now).getUTCFullYear(),
      round: 0,
      revision: 0,
      status: 'active',
      clubs: normalize(clubs),
      players: normalize(players),
      stadiums: normalize(stadiums),
      centers: normalize(centers),
      participants: [{ userId: input.userId, clubId: ownClub.id, ready: false }],
      ...schedule,
      results: [],
      negotiations: [],
      injuries: {},
      tactics: {},
      chemistry: {},
      workload: {},
      development: {},
      debts: {},
      lastProcessedAt: initialDate,
      nextScheduledAt:
        input.mode === 'multiplayer' ? nextRealMatchTime(input.now) : schedule.nextScheduledAt,
      ...(input.mode === 'multiplayer' ? { seasonClock: 1 as const } : {}),
      createdAt: initialDate,
    }),
    initializeStartingChemistry,
  );
}

function fictionalPlayer(
  index: number,
  clubId: string | null,
  slot: number,
  divisionIndex: number,
  random: () => number,
): PlayerSnapshot {
  const overall = Math.min(95, 62 - divisionIndex * 8 + Math.floor(random() * 20));
  return {
    id: stableId(2, index + 1),
    name: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]}`,
    nationality: 'BR',
    clubId,
    position: POSITIONS[slot] ?? 'ST',
    shirtNumber: slot + 1,
    age: 17 + Math.floor(random() * 19),
    overall,
    potential: Math.min(99, overall + Math.floor(random() * 15)),
    morale: 70 + Math.floor(random() * 25),
    fitness: 100,
    appearances: 0,
    salary: { cents: overall * overall * 100, currency: 'BRL' },
    marketValue: { cents: overall * overall * 20000, currency: 'BRL' },
    appearance: {
      skinTone: SKIN_TONES[index % SKIN_TONES.length] ?? '#b27b50',
      hairColor: '#241d1a',
      hairStyle: (['short', 'curly', 'bald', 'braids', 'long'] as const)[index % 5] ?? 'short',
      beardStyle: (['none', 'stubble', 'full'] as const)[index % 3] ?? 'none',
    },
  };
}

export function seasonSchedule(
  clubs: readonly ClubSnapshot[],
  start: number,
  qualifications?: Readonly<{
    libertadores: readonly string[];
    sulAmericana: readonly string[];
    serieB?: readonly string[];
    preLibertadores?: readonly string[];
  }>,
  drawSeed = start,
): {
  fixtures: Fixture[];
  cups: CupNode[];
  nextScheduledAt: number;
  competitionNotes: Record<string, string>;
  competitionRulesVersion: number;
  competitionDraws: NonNullable<WorldState['competitionDraws']>;
} {
  const competitionDraws: NonNullable<WorldState['competitionDraws']> = [];
  const year = new Date(start).getUTCFullYear();
  const fixtures: Fixture[] = [];
  const cups: CupNode[] = [];
  const competitionNotes: Record<string, string> = {};
  for (const rule of COMPETITIONS.filter(
    (item) => item.format === 'league' && item.division !== 'D',
  )) {
    const ids = clubs
      .filter((club) => club.country === 'BR' && club.division === rule.division)
      .map((club) => club.id);
    const result = roundRobin(ids, rule.legs);
    if (result.ok)
      for (const match of result.value)
        fixtures.push({
          ...match,
          id: `${rule.id}:${match.round}:${match.homeId}`,
          competitionId: rule.id,
          scheduledAt:
            competitionDates(rule.id, year, Math.max(...result.value.map((row) => row.round)) + 1)[
              match.round
            ] ?? start,
        });
  }
  const cupRules = COMPETITIONS.filter(
    (rule) =>
      rule.format === 'knockout' && !['intercontinental', 'pre-libertadores'].includes(rule.id),
  );
  const foreignByCountry = new Map<string, string[]>();
  for (const club of clubs.filter(
    (club) =>
      ['AR', 'UY', 'CL', 'CO', 'EC', 'PY', 'BO', 'VE', 'PE'].includes(club.country) &&
      club.playerIds.length >= 11,
  )) {
    const bucket = foreignByCountry.get(club.country) ?? [];
    bucket.push(club.id);
    foreignByCountry.set(club.country, bucket);
  }
  const foreignPool: string[] = [];
  for (let index = 0; index < 32; index++)
    for (const ids of foreignByCountry.values()) if (ids[index]) foreignPool.push(ids[index]!);
  const usedForeign = new Set<string>();
  if (!qualifications) {
    const pre = fixedCupParticipants(clubs, 'pre-libertadores');
    if (pre && !pre.missing.length) {
      const ids = shuffleCupParticipants(pre.participants, drawSeed, 'pre-libertadores');
      competitionDraws.push({
        id: `draw:pre-libertadores:${year}`,
        competitionId: 'pre-libertadores',
        scheduledAt: seasonStart(year) + 86400000,
        participantIds: pre.participants,
        kind: 'knockout',
        seed: drawSeed,
      });
      for (let i = 0; i < ids.length; i += 2)
        cups.push({
          id: `pre-libertadores:${i / 2}`,
          competitionId: 'pre-libertadores',
          round: 0,
          homeId: ids[i]!,
          awayId: ids[i + 1]!,
          leftId: null,
          rightId: null,
          winnerId: null,
          scheduledAt: competitionDates('pre-libertadores', year, 1)[0]!,
          legs: 2,
          label: 'Pré-Libertadores',
        });
    }
  }
  for (const rule of cupRules) {
    let selected: string[] = [];
    const official = CUP_PARTICIPANTS_2026[rule.id];
    const genericRegional = ['copa-nordeste', 'copa-verde', 'copa-sul-sudeste'].includes(rule.id);
    const fixed = !qualifications ? fixedCupParticipants(clubs, rule.id) : undefined;
    if (fixed) {
      if (fixed.missing.length) {
        competitionNotes[rule.id] = 'Participantes ausentes na base: ' + fixed.missing.join(', ');
        continue;
      }
      selected = shuffleCupParticipants(fixed.participants, drawSeed, rule.id);
      competitionDraws.push({
        id: `draw:${rule.id}:${year}`,
        competitionId: rule.id,
        scheduledAt: seasonStart(year) + (competitionDraws.length + 1) * 86400000,
        participantIds: [...fixed.participants],
        kind: rule.groupSize ? 'groups' : 'knockout',
        seed: drawSeed,
      });
    } else if (genericRegional) {
      const pool = clubs.filter(
        (club) => club.country === 'BR' && club.division !== 'A' && club.playerIds.length >= 11,
      );
      const preferred = (
        official ??
        (rule.id === 'copa-norte' ? CUP_PARTICIPANTS_2026['copa-verde']?.slice(0, 12) : []) ??
        []
      ).flatMap((name) => {
        const club = pool.find((c) => competitionClubKey(c.name) === competitionClubKey(name));
        return club ? [club.id] : [];
      });
      const regionalPool = pool
        .filter((club) => ['C', 'D', 'REGIONAL'].includes(club.division))
        .map((club) => club.id);
      const all = [...new Set([...preferred, ...regionalPool, ...pool.map((club) => club.id)])];
      selected = all.slice(0, rule.teamCount);
      competitionNotes[rule.id] =
        '16 clubes fora da Série A, quatro grupos de quatro e seis partidas por clube. Os dois primeiros avançam às quartas de final.';
    } else if (['libertadores', 'sul-americana'].includes(rule.id)) {
      const offset = rule.id === 'libertadores' ? 0 : 6;
      const key = rule.id === 'libertadores' ? 'libertadores' : 'sulAmericana';
      const domestic = [
        ...(qualifications?.[key] ??
          clubs
            .filter((club) => club.country === 'BR' && club.division === 'A')
            .slice(offset, offset + (key === 'libertadores' ? 4 : 5))
            .map((club) => club.id)),
      ];
      if (rule.id === 'libertadores') {
        const pre = [
          ...(qualifications?.preLibertadores ??
            clubs
              .filter((club) => club.country === 'BR' && club.division === 'A')
              .slice(4, 6)
              .map((club) => club.id)),
        ];
        for (const [preIndex, id] of pre.entries()) {
          const opponent = foreignPool[foreignPool.length - 1 - preIndex];
          if (!opponent) continue;
          domestic.push(id);
          usedForeign.add(opponent);
          cups.push({
            id: `pre-libertadores:${preIndex}`,
            competitionId: 'pre-libertadores',
            round: 0,
            homeId: id,
            awayId: opponent,
            leftId: null,
            rightId: null,
            winnerId: null,
            scheduledAt: competitionDates('pre-libertadores', year, 1)[0]!,
            legs: 2,
            label: 'Pré-Libertadores',
          });
        }
      }
      if (rule.id === 'sul-americana' && qualifications) {
        // Reserve the eventual losers' seats without enlarging the groups after the pre.
        domestic.push(
          ...cups
            .filter((n) => n.competitionId === 'pre-libertadores')
            .flatMap((n) => (n.homeId ? [n.homeId] : [])),
        );
      }
      const needed = rule.teamCount - domestic.length;
      const availableForeign = foreignPool.filter(
        (id) => !usedForeign.has(id) && !domestic.includes(id),
      );
      const foreigners = availableForeign.slice(0, needed);
      selected = [...domestic, ...foreigners];
      selected.forEach((id) => usedForeign.add(id));
      if (selected.length < rule.teamCount) {
        competitionNotes[rule.id] = 'Base insuficiente para completar os grupos da competição.';
        continue;
      }
      selected.sort((a, b) =>
        clubs
          .find((c) => c.id === a)!
          .country.localeCompare(clubs.find((c) => c.id === b)!.country),
      );
    } else if (rule.id === 'europa') {
      selected = clubs
        .filter(
          (club) =>
            [
              'DE',
              'GB',
              'ES',
              'IT',
              'FR',
              'PT',
              'NL',
              'BE',
              'TR',
              'GR',
              'AT',
              'CH',
              'DK',
              'HR',
              'RS',
              'UA',
            ].includes(club.country) && club.playerIds.length >= 11,
        )
        .slice(0, 32)
        .map((club) => club.id);
    } else if (rule.id === 'copa-brasil') {
      const a = clubs
        .filter((club) => club.country === 'BR' && club.division === 'A')
        .map((club) => club.id);
      const b =
        qualifications?.serieB ??
        clubs
          .filter((club) => club.country === 'BR' && club.division === 'B')
          .map((club) => club.id);
      const currentB = [
        ...new Set([
          ...b,
          ...clubs
            .filter((club) => club.country === 'BR' && club.division === 'B')
            .map((club) => club.id),
        ]),
      ].filter((id) => clubs.find((club) => club.id === id)?.division === 'B');
      selected = [...a.slice(0, 20), ...currentB.slice(0, 12)];
    } else {
      selected = clubs
        .filter((club) => club.country === 'BR' && club.playerIds.length >= 11)
        .slice(0, rule.teamCount)
        .map((club) => club.id);
    }
    if (
      !fixed &&
      selected.length === rule.teamCount &&
      [
        'copa-brasil',
        'libertadores',
        'sul-americana',
        'copa-sul-sudeste',
        'copa-nordeste',
        'copa-verde',
      ].includes(rule.id)
    ) {
      selected = shuffleCupParticipants(selected, drawSeed, rule.id);
      competitionDraws.push({
        id: `draw:${rule.id}:${year}`,
        competitionId: rule.id,
        scheduledAt: seasonStart(year) + (competitionDraws.length + 1) * 86400000,
        participantIds: [...selected],
        kind: rule.groupSize ? 'groups' : 'knockout',
        seed: drawSeed,
      });
    }
    if (rule.groupSize) {
      if (selected.length !== rule.teamCount) {
        competitionNotes[rule.id] =
          `São necessários ${rule.teamCount} participantes para este formato.`;
        continue;
      }
      const provisional = groupFixtures(
        selected,
        rule.id,
        Array.from({ length: 80 }, (_, i) => start + i * 86400000),
        rule.groupLegs ?? 1,
      );
      const dates = competitionDates(
        rule.id,
        year,
        Math.max(...provisional.map((game) => game.round)) + 1,
      );
      fixtures.push(...provisional.map((game) => ({ ...game, scheduledAt: dates[game.round]! })));
      continue;
    }
    const size = 2 ** Math.floor(Math.log2(selected.length));
    const bracket = buildBracket(
      selected.slice(0, size),
      rule.id,
      competitionDates(rule.id, year, Math.log2(size), true),
    );
    if (bracket.ok)
      cups.push(
        ...bracket.value.map((node) => ({
          ...node,
          legs: knockoutLegs(rule.id, node.round, Math.log2(size) - 1),
        })),
      );
  }
  return {
    fixtures,
    cups,
    competitionDraws,
    competitionNotes,
    competitionRulesVersion: SEASON_CALENDAR_VERSION,
    nextScheduledAt: Math.min(
      ...fixtures.map((fixture) => fixture.scheduledAt),
      ...cups.map((node) => node.scheduledAt),
    ),
  };
}
