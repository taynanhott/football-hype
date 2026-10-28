import { isSerieC2026 } from '@football/shared';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createWorld, stableId } from '@football/domain';
import {
  clubKit,
  importedAppearance,
  worldDatasetSchema,
  type WorldDataset,
  type PlayerSnapshot,
  type ClubSnapshot,
  type StadiumSnapshot,
  type TrainingCenterSnapshot,
} from '@football/shared';
const position: Record<string, PlayerSnapshot['position']> = {
  GOL: 'GK',
  ZAG: 'CB',
  LD: 'RB',
  LE: 'LB',
  VOL: 'DM',
  MC: 'CM',
  MEI: 'AM',
  PD: 'RW',
  PE: 'LW',
  ME: 'LM',
  MD: 'RM',
  CA: 'ST',
  SA: 'ST',
};
const iso: Record<string, string> = Object.fromEntries(
  'GUT:GT NIG:NE MAU:MR CON:CG EGY:EG KSA:SA THE:TH COM:KM GBS:GW NZL:NZ MLT:MT SIE:SL THA:TH TAJ:TJ LAT:LV FAR:FO CYP:CY NIR:GB MTQ:MQ MNE:ME JOR:JO CHA:TD MOL:MD GLP:GP BRA:BR ARG:AR COL:CO URU:UY PAR:PY CHI:CL EQU:EC PER:PE BOL:BO VEN:VE ING:GB ESC:GB GAL:GB IRL:IE ALE:DE ESP:ES POR:PT ITA:IT FRA:FR HOL:NL BEL:BE DIN:DK SUE:SE NOR:NO FIN:FI ISL:IS ICE:IS AUT:AT SUI:CH POL:PL TCH:CZ ESQ:SK ESL:SI CRO:HR BOS:BA SER:RS GRE:GR TUR:TR RUS:RU UCR:UA ROM:RO BUL:BG HUN:HU ALB:AL KOS:XK MON:ME LUX:LU LIT:LT LET:LV EST:EE MEX:MX EUA:US CAN:CA CRC:CR PAN:PA HON:HN ELS:SV GUA:GT NIC:NI JAM:JM HAI:HT DOM:DO PUE:PR TRI:TT CUR:CW SUR:SR GUI:GN GAN:GH CAM:CM NGA:NG SEN:SN CIV:CI MLI:ML MAL:ML MAR:MA EGI:EG TUN:TN ARL:DZ ANG:AO GAB:GA DRC:CD CEN:CF BUR:BF TOG:TG CPV:CV MOZ:MZ RSA:ZA SOU:ZA AFS:ZA ZAM:ZM ZIM:ZW UGA:UG KEN:KE BEN:BJ GAM:GM LIB:LR GUB:GW EQG:GQ MAD:MG TAN:TZ RWA:RW SOM:SO SUD:SD JAP:JP COR:KR CHN:CN CHI2:CN AUS:AU NEW:NZ IRA:IR IRQ:IQ ARAB:SA ARA:SA QAT:QA CAT:QA UNI:AE EAU:AE ISR:IL SYR:SY ARM:AM GEO:GE KAZ:KZ CAZ:KZ UZB:UZ AZE:AZ IND:IN BAN:BD IDN:ID INDO:ID MAS:MY MALAS:MY TAI:TH TAY:TH VIE:VN PHI:PH FIL:PH SIN:SG NEP:NP LBN:LB PAQ:PK PAL:PS FRE:GF'
    .split(' ')
    .map((v) => v.split(':')),
);
const leagueCountries: Record<string, string> = {
  Brasileirão: 'BR',
  'Brasileirão B': 'BR',
  Regional: 'BR',
  Base: 'BR',
  'Liga Argentina': 'AR',
  'Liga Colombiana': 'CO',
  'Liga URU': 'UY',
  'Liga CHI': 'CL',
  'Liga PAR': 'PY',
  'Liga EQU': 'EC',
  'Liga PER': 'PE',
  'Liga BOL': 'BO',
  'Premier League': 'GB',
  LaLiga: 'ES',
  Bundesliga: 'DE',
  'Serie A (ITA)': 'IT',
  'Ligue 1': 'FR',
  'Liga Portugal': 'PT',
  Eredivisie: 'NL',
  MLS: 'US',
  'Liga MX': 'MX',
  'Saudi Pro League': 'SA',
  'Süper Lig': 'TR',
};
const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const clubId = (name: string) =>
  stableId(31, parseInt(createHash('sha256').update(normal(name)).digest('hex').slice(0, 12), 16));
const normalized = <T extends { id: string }>(rows: T[]) => ({
  ids: rows.map((p) => p.id),
  byId: Object.fromEntries(rows.map((p) => [p.id, p])),
});
const rowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  club: z.string(),
  pos: z.string(),
  age: z.number().int().min(14).max(100),
  nat: z.string(),
  overall: z.number().int().min(1).max(99),
  league: z.string(),
  value: z.number().nonnegative(),
});
type Row = z.infer<typeof rowSchema> & { potential?: number };
const metaSchema = z.record(
  z.string(),
  z.object({
    abbreviation: z.string().nullish(),
    pattern: z.string().nullish(),
    colors: z.array(z.string().nullable()).nullish(),
    support: z.number().nullish(),
    lvl: z.number().nullish(),
    nat: z.string().nullish(),
    group: z.string(),
  }),
);
export function convertLocalPlayers(
  input: unknown,
  metadata: unknown,
  excludedIds: readonly number[] = [],
): { dataset: WorldDataset; report: Record<string, unknown> } {
  const inactive: { id: number; reason: string }[] = [];
  const raw = z.record(z.string(), z.unknown()).parse(input),
    meta = metaSchema.parse(metadata),
    rows = new Map<number, Row>(),
    skipped: unknown[] = [],
    duplicates: number[] = [];
  const groups = [
    'bra',
    'rel',
    'b26',
    'reg26',
    'arg',
    'col',
    'intl',
    'young',
    'int26',
    'tm26',
    'br5',
  ];
  for (const group of groups)
    for (const value of (Array.isArray(raw[group]) ? raw[group] : []) as unknown[]) {
      if (!Array.isArray(value)) continue;
      const [id, name, , club, pos, , age, nat, overall, league, money] = value;
      if (rows.has(id)) {
        duplicates.push(id);
        continue;
      }
      const isBase = group === 'base26';
      const candidate = rowSchema.safeParse({
        id,
        name,
        club,
        pos,
        age,
        nat,
        overall,
        league: isBase ? 'Base' : league,
        value: isBase ? Number(value[10]) || 0 : Number(money) || 0,
      });
      if (!candidate.success || !position[String(pos)]) {
        skipped.push({ group, id, reason: 'Registro incompatível' });
        continue;
      }
      rows.set(id, candidate.data);
    }
  for (const value of (raw.mv26 ?? []) as unknown[][]) {
    const row = rows.get(Number(value[0]));
    if (row) {
      row.club = String(value[1]);
      row.league = String(value[2]);
    }
  }
  for (const value of (raw.aud26 ?? []) as number[][]) {
    const row = rows.get(value[0]!);
    if (row) {
      row.overall = Math.max(1, Math.min(99, value[1]!));
      row.potential = Math.max(row.overall, Math.min(99, value[2]!));
    }
  }
  for (const value of (raw.f45 ?? []) as number[][]) {
    const row = rows.get(value[0]!);
    if (row && row.overall === 45) row.overall = Math.max(1, Math.min(99, value[1]!));
  }
  const world = createWorld({
    id: stableId(90, 50),
    userId: 'local-import',
    name: 'Base local',
    mode: 'offline',
    now: Date.UTC(2026, 0, 1),
  });
  if (!world.ok) throw Error(world.error.message);
  const templateClub = world.value.clubs.byId[world.value.clubs.ids[0]!]!,
    templatePlayer = world.value.players.byId[world.value.players.ids[0]!]!,
    templateStadium = world.value.stadiums.byId[templateClub.stadiumId]!,
    templateCenter = world.value.centers.byId[templateClub.trainingCenterId]!;
  for (const [id, row] of rows)
    if (excludedIds.includes(id) || /^(aposentado|retired)$/i.test(row.club.trim())) {
      inactive.push({
        id,
        reason: excludedIds.includes(id)
          ? 'Exclusão da configuração original'
          : 'Aposentado no arquivo',
      });
      rows.delete(id);
    }
  const names = new Map<string, string>();
  for (const name of Object.keys(meta)) names.set(normal(name), name);
  const rosters = new Map<string, Row[]>(),
    free: Row[] = [];
  for (const row of rows.values()) {
    if (/^(sem clube|livre|free agent|retired|aposentado)$/i.test(row.club.trim())) {
      free.push(row);
      continue;
    }
    const key = normal(row.club),
      name = names.get(key) ?? row.club.trim();
    names.set(key, name);
    const roster = rosters.get(name) ?? [];
    roster.push(row);
    rosters.set(name, roster);
  }
  const clubs: ClubSnapshot[] = [],
    players: PlayerSnapshot[] = [],
    stadiums: StadiumSnapshot[] = [],
    centers: TrainingCenterSnapshot[] = [],
    unknownCountries = new Set<string>();
  const countries = (code: string) => {
    if (iso[code]) return iso[code]!;
    if (/^[A-Z]{2}$/.test(code)) return code;
    unknownCountries.add(code);
    return 'ZZ';
  };
  const player = (row: Row, owner: string | null, index: number): PlayerSnapshot => ({
    ...templatePlayer,
    appearance: importedAppearance(stableId(32, row.id)),
    id: stableId(32, row.id),
    clubId: owner,
    name: row.name,
    position: position[row.pos]!,
    age: row.age,
    nationality: countries(row.nat),
    overall: row.overall,
    potential: Math.max(
      row.overall,
      row.potential ?? Math.min(99, row.overall + (row.age < 23 ? 10 : 0)),
    ),
    shirtNumber: Math.max(
      1,
      Math.min(
        99,
        Number((raw.nums as Record<string, unknown> | undefined)?.[row.id]) || (index % 99) + 1,
      ),
    ),
    salary: { cents: row.overall * row.overall * 100, currency: 'BRL' },
    marketValue: { cents: Math.round(row.value * 1000 * 100 * 6), currency: 'BRL' },
    appearances: 0,
    morale: 80,
    fitness: 100,
  });
  const ordered = [...rosters].sort(([a], [b]) => {
    const rank = (n: string) =>
      meta[n]?.group === 'CLUBS_A'
        ? 0
        : meta[n]?.group === 'CLUBS_REL' || meta[n]?.group === 'CLUBS_B_GEN'
          ? 1
          : 2;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  for (const [name, roster] of ordered) {
    const m = meta[name],
      id = clubId(name),
      stadiumId = stableId(33, parseInt(id.slice(-12), 16)),
      trainingCenterId = stableId(34, parseInt(id.slice(-12), 16));
    let country = m?.nat
      ? countries(m.nat)
      : (leagueCountries[roster.find((p) => p.league !== 'Base')?.league ?? 'Base'] ?? 'ZZ');
    if (country === 'ZZ') {
      const tag = roster
        .find((p) => /\([^)]+\)$/.test(p.league))
        ?.league.match(/\(([^)]+)\)$/)?.[1]
        ?.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (tag && iso[tag]) country = iso[tag]!;
    }
    if (m?.group.startsWith('CLUBS_') && !m.nat) country = 'BR';
    const division: ClubSnapshot['division'] =
      country === 'BR'
        ? isSerieC2026(name)
          ? 'C'
          : m?.group === 'CLUBS_A'
            ? 'A'
            : m?.group === 'CLUBS_REL' || m?.group === 'CLUBS_B_GEN'
              ? 'B'
              : m?.group === 'CLUBS_REG_GEN'
                ? 'D'
                : 'REGIONAL'
        : 'REGIONAL';
    const strongest = roster
      .map((p) => p.overall)
      .sort((a, b) => b - a)
      .slice(0, 11);
    const strength = strongest.reduce((a, b) => a + b, 0) / strongest.length;
    const level = m?.support
      ? Math.min(5, Math.max(1, Math.ceil(m.support / 2)))
      : strength >= 84
        ? 5
        : strength >= 76
          ? 4
          : strength >= 67
            ? 3
            : strength >= 56
              ? 2
              : 1;
    const kit = clubKit({ name }),
      colors = m?.colors?.filter((v): v is string => !!v && /^#[a-f0-9]{6}$/i.test(v)) ?? [];
    const pattern = m?.pattern?.startsWith('hoops')
      ? 'hoops'
      : m?.pattern === 'vstripes'
        ? 'stripes'
        : m?.pattern === 'sash'
          ? 'sash'
          : m?.pattern === 'band'
            ? 'hoops'
            : kit.pattern;
    const squad = roster.map((p, i) => player(p, id, i));
    players.push(...squad);
    clubs.push({
      ...templateClub,
      id,
      name,
      country,
      division,
      abbreviation: (
        m?.abbreviation ||
        name.replace(/[^a-zA-Z]/g, '').slice(0, 5) ||
        'CLUBE'
      ).slice(0, 5),
      kit:
        colors.length >= 2
          ? {
              primary: colors[0]!,
              secondary: colors[1]!,
              ...(colors[2] ? { tertiary: colors[2] } : {}),
              pattern,
            }
          : kit,
      playerIds: squad.map((p) => p.id),
      stadiumId,
      trainingCenterId,
      leagueStrength: Math.round(squad.reduce((n, p) => n + p.overall, 0) / squad.length),
      balance: { cents: 100000000 * level * level, currency: 'BRL' },
    });
    stadiums.push({
      ...templateStadium,
      id: stadiumId,
      clubId: id,
      name: 'Estádio ' + name,
      pitchLevel: level,
      surroundingsLevel: level,
      sectors: templateStadium.sectors.map((s) => ({ ...s, level, capacity: 1800 * level })),
      commerce: { foodLevel: level, shirtsLevel: level, hospitalityLevel: level },
    });
    centers.push({
      ...templateCenter,
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
  players.push(...free.map((p, i) => player(p, null, i)));
  for (const value of (raw.base26 ?? []) as unknown[][]) {
    if (rows.has(Number(value[0])) || excludedIds.includes(Number(value[0]))) continue;
    const parsed = rowSchema.safeParse({
      id: value[0],
      name: value[1],
      club: value[3],
      pos: value[4],
      age: value[6],
      nat: value[7],
      overall: value[8],
      league: 'Base',
      value: Number(value[10]) || 0,
    });
    if (!parsed.success || !position[parsed.data.pos]) continue;
    const owner = clubs.find((club) => normal(club.name) === normal(parsed.data.club));
    if (owner) players.push({ ...player(parsed.data, null, 0), academyClubId: owner.id });
  }
  const dataset = worldDatasetSchema.parse({
    clubs: normalized(clubs),
    players: normalized(players),
    stadiums: normalized(stadiums),
    centers: normalized(centers),
    source: 'Base local do arquivo fornecido · Treineiros · 2026',
    license:
      'Dados fornecidos pelo usuário para uso local. Identidades, vínculos, idades, posições e avaliações vêm do arquivo, incluindo suas correções. Potenciais não informados, salários, finanças e estruturas são parâmetros de jogo; valores usam conversão fixa de simulação, não cotação financeira. Não há atualização por API.',
  });
  return {
    dataset,
    report: {
      players: players.length,
      clubs: clubs.length,
      freeAgents: free.length,
      duplicates: duplicates.length,
      skipped,
      inactive,
      unknownNationalities: [...unknownCountries],
      divisions: Object.fromEntries(
        ['A', 'B', 'C', 'D', 'REGIONAL'].map((d) => [
          d,
          clubs.filter((c) => c.country === 'BR' && c.division === d).length,
        ]),
      ),
      partialSquads: clubs
        .filter(
          (c) =>
            c.playerIds.length < 11 ||
            !c.playerIds.some((id) => dataset.players.byId[id]?.position === 'GK'),
        )
        .map((c) => ({ name: c.name, players: c.playerIds.length })),
      notes: [
        'Os 20 participantes da Série C de 2026 foram separados do grupo Regional conforme o regulamento e a relação oficial da CBF.',
        'Elencos incompletos são mantidos para consulta e mercado, sem completar com jogadores inventados.',
      ],
    },
  };
}
