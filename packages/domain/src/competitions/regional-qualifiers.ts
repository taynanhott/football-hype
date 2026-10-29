import { type WorldState, type ClubSnapshot } from '@football/shared';
import { competitionClubKey } from '@football/shared';
import { roundRobin } from './round-robin.js';
import { standings } from './standings.js';
import { seasonStart, competitionDates } from './season-calendar.js';
import { groupFixtures } from './cup-groups.js';
import { shuffleCupParticipants } from './fixed-participants.js';

export const REGIONAL_QUALIFIERS = [
  { id: 'seletiva-nordeste', cupId: 'copa-nordeste', name: 'Seletiva do Nordeste' },
  { id: 'seletiva-sul-sudeste', cupId: 'copa-sul-sudeste', name: 'Seletiva Sul-Sudeste' },
  { id: 'seletiva-verde', cupId: 'copa-verde', name: 'Seletiva da Copa Verde' },
] as const;
const names = {
  'copa-nordeste': [
    'Ceará',
    'CRB',
    'Fortaleza',
    'Náutico',
    'Sport',
    'Botafogo-PB',
    'Confiança',
    'Floresta',
    'Itabaiana',
    'Maranhão',
    'Santa Cruz',
    'ABC',
    'Altos',
    'América-RN',
    'CSA',
    'Ferroviário',
    'Juazeirense',
    'Moto Club',
    'Sampaio Corrêa',
    'Sergipe',
    'Treze',
    'Vitória',
    'Bahia',
  ],
  'copa-verde': [
    'Atlético-GO',
    'Cuiabá',
    'Goiás',
    'Vila Nova',
    'Amazonas',
    'Anápolis',
    'Paysandu',
    'Águia de Marabá',
    'Araguaína',
    'Brasiliense',
    'Capital',
    'Gama',
    'GAS',
    'Independência-AC',
    'Luverdense',
    'Nacional-AM',
    'Operário-MS',
    'Porto Velho',
    'Primavera',
    'Trem',
    'Remo',
  ],
  'copa-sul-sudeste': [
    'América-MG',
    'Athletic',
    'Avaí',
    'Botafogo-SP',
    'Criciúma',
    'Juventude',
    'Londrina',
    'Novorizontino',
    'Operário-PR',
    'Ponte Preta',
    'São Bernardo',
    'Barra',
    'Brusque',
    'Caxias',
    'Ferroviária',
    'Figueirense',
    'Guarani',
    'Inter de Limeira',
    'Ituano',
    'Maringá',
    'Volta Redonda',
    'Ypiranga',
    'Cianorte',
    'Portuguesa',
    'Chapecoense',
    'Mirassol',
    'Coritiba',
    'Santos',
    'Palmeiras',
    'Flamengo',
    'Fluminense',
    'Vasco',
    'Botafogo',
    'São Paulo',
    'Corinthians',
    'Cruzeiro',
    'Atlético-MG',
    'Internacional',
    'Grêmio',
    'Bragantino',
    'Athletico-PR',
  ],
};
export function regionalCupForClub(club: ClubSnapshot) {
  if (club.country !== 'BR') return undefined;
  return Object.entries(names).find(([, list]) =>
    list.some((name) => competitionClubKey(name) === competitionClubKey(club.name)),
  )?.[0];
}

/** Rank using last season's final table, but apply the new season's divisions. */
export function scheduleRegionalQualifiers(previous: WorldState, next: WorldState): WorldState {
  const fixtures = next.fixtures.filter(
    (f) =>
      f.competitionId !== 'serie-d' &&
      !REGIONAL_QUALIFIERS.some((q) => q.id === f.competitionId) &&
      !REGIONAL_QUALIFIERS.some((q) => q.cupId === f.competitionId),
  );
  const qualifiers: NonNullable<WorldState['regionalQualifiers']> = [];
  const competitionNotes = { ...next.competitionNotes };
  let draws = [...(next.competitionDraws ?? [])];
  for (const rule of REGIONAL_QUALIFIERS) {
    const eligible = Object.values(next.clubs.byId).filter(
      (c) => ['B', 'C', 'D'].includes(c.division) && regionalCupForClub(c) === rule.cupId,
    );
    const champion = previous.cups
      .filter((n) => n.competitionId === rule.cupId)
      .sort((a, b) => b.round - a.round)[0]?.winnerId;
    const direct: string[] = [];
    if (champion && eligible.some((c) => c.id === champion)) direct.push(champion);
    const rank = new Map<string, number>();
    for (const [divisionIndex, division] of ['A', 'B', 'C', 'D'].entries()) {
      const ids = previous.clubs.ids.filter((id) => previous.clubs.byId[id]?.division === division);
      standings(
        ids,
        previous.fixtures.filter((f) => f.competitionId === `serie-${division.toLowerCase()}`),
        previous.results,
      ).forEach((row, index) => rank.set(row.id, divisionIndex * 100 + index));
    }
    for (const division of ['B', 'C'])
      for (const c of eligible
        .filter((c) => c.division === division)
        .sort(
          (a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999) || a.id.localeCompare(b.id),
        ))
        if (direct.length < 16 && !direct.includes(c.id)) direct.push(c.id);
    const candidates = eligible
      .filter((c) => c.division === 'D' && !direct.includes(c.id))
      .map((c) => c.id);
    const slots = Math.max(0, 16 - direct.length);
    const qualifiedIds =
      candidates.length <= slots ? [...candidates] : slots === 0 ? [] : undefined;
    if (qualifiedIds === undefined) {
      const games = roundRobin(candidates, 1);
      if (!games.ok) throw new Error(games.error.message);
      fixtures.push(
        ...games.value.map((f) => ({
          ...f,
          id: `${rule.id}:${next.season}:${f.round}:${f.homeId}`,
          competitionId: rule.id,
          scheduledAt: seasonStart(next.season) + (3 + f.round * 3) * 86400000 + 8 * 3600000,
        })),
      );
    }
    qualifiers.push({
      competitionId: rule.id,
      cupId: rule.cupId,
      candidateIds: candidates,
      directIds: direct,
      slots,
      ...(qualifiedIds ? { qualifiedIds } : {}),
    });
    const provisional = [...direct, ...(qualifiedIds ?? candidates.slice(0, slots))];
    if (provisional.length !== 16) {
      competitionNotes[rule.cupId] =
        `Base regional insuficiente: ${provisional.length} clubes para 16 vagas.`;
      draws = draws.filter((d) => d.competitionId !== rule.cupId);
      continue;
    }
    const last = Math.max(
      seasonStart(next.season),
      ...fixtures.filter((f) => f.competitionId === rule.id).map((f) => f.scheduledAt),
    );
    fixtures.push(
      ...groupFixtures(
        shuffleCupParticipants(provisional, next.seed, rule.cupId),
        rule.cupId,
        competitionDates(rule.cupId, next.season, 6).map((at, round) =>
          Math.max(at, last + (3 + round * 3) * 86400000),
        ),
        2,
      ),
    );
    draws = draws.filter((d) => d.competitionId !== rule.cupId);
    draws.push({
      id: `draw:${rule.cupId}:${next.season}`,
      competitionId: rule.cupId,
      kind: 'groups',
      seed: next.seed,
      participantIds: provisional,
      scheduledAt: last + 86400000,
    });
  }
  return {
    ...next,
    fixtures,
    competitionNotes,
    competitionDraws: draws,
    regionalQualifiers: qualifiers,
    ...(!next.seasonClock
      ? {
          nextScheduledAt: Math.min(
            ...fixtures.map((f) => f.scheduledAt),
            ...next.cups.map((n) => n.scheduledAt),
          ),
        }
      : {}),
  };
}

export function resolveRegionalQualifiers(state: WorldState): WorldState {
  const completed = new Set(state.results.map((r) => r.fixtureId));
  let changed = false;
  const qualifiers = state.regionalQualifiers?.map((q) => {
    if (q.qualifiedIds !== undefined) return q;
    const games = state.fixtures.filter((f) => f.competitionId === q.competitionId);
    if (!games.length || games.some((f) => !completed.has(f.id))) return q;
    changed = true;
    return {
      ...q,
      qualifiedIds: standings(q.candidateIds, games, state.results)
        .slice(0, q.slots)
        .map((row) => row.id),
    };
  });
  if (!changed) return state;
  return {
    ...state,
    regionalQualifiers: qualifiers,
    competitionDraws: state.competitionDraws?.map((draw) => {
      const q = qualifiers?.find(
        (q) => q.cupId === draw.competitionId && q.qualifiedIds !== undefined,
      );
      return q ? { ...draw, participantIds: [...q.directIds, ...q.qualifiedIds!] } : draw;
    }),
  };
}
