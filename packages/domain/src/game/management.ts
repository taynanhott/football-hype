import { formatMoney } from '@football/shared';
import {
  averageMonthlySalary,
  renewalPatience,
  renewalTerms,
  contractExpires,
} from './player-contracts.js';
import { prepareAcademy } from './academy.js';
import { scheduledFixtures } from '../competitions/fixtures.js';
import { upgradePrice, facilityCosts } from '../finance/facility-costs.js';
export { upgradePrice, maintenanceForLevel } from '../finance/facility-costs.js';
import {
  GAMEPLAY,
  CENTER_SERVICES,
  MAX_SQUAD_SIZE,
  MIN_SQUAD_SIZE,
  FORMATIONS,
  ceilMoney,
  roundMoney,
  MONEY_STEPS,
  type ClubSnapshot,
  type PlayerSnapshot,
  type WorldState,
  type PlayStyle,
  type Formation,
} from '@football/shared';
import { financialLimits } from '../finance/financial-management.js';
import { failure, success } from '../core/result.js';
import { domainError } from '../core/domain-error.js';
import type { CommandContext, CommandOutcome } from './command-handlers.js';
import type { Result } from '../core/result.js';

export const STYLE_LABELS: Record<PlayStyle, string> = {
  balanced: 'Equilibrado',
  wings: 'Avanço pelas pontas',
  gegenpress: 'Gegenpress',
  'all-out-press': 'Pressão total',
  'low-block': 'Recuo total',
  possession: 'Posse de bola',
  counter: 'Contra-ataque',
};
export function potentialStars(potential: number) {
  return Math.max(1, Math.min(5, Math.ceil((potential - 49) / 10)));
}
export function isRival(a: ClubSnapshot, b: ClubSnapshot) {
  return (
    a.id !== b.id &&
    a.country === b.country &&
    [
      ['FLA', 'FLU', 'BOT', 'VAS'],
      ['COR', 'PAL', 'SAN', 'SAO'],
      ['GRE', 'INT'],
      ['CAM', 'CRU'],
      ['BAH', 'VIT'],
      ['SPO', 'NAU', 'STA'],
      ['FOR', 'CEA'],
    ].some(
      (group) =>
        group.includes(a.abbreviation.toUpperCase()) &&
        group.includes(b.abbreviation.toUpperCase()),
    )
  );
}
export function contractEnd(state: WorldState, player: PlayerSnapshot) {
  return contractExpires(state, player);
}
export function interestLabel(score: number) {
  return score <= 0
    ? 'Nenhum'
    : score <= 25
      ? 'Baixo'
      : score <= 50
        ? 'Médio'
        : score <= 75
          ? 'Alto'
          : 'Muito interesse';
}
export function transferContext(
  state: WorldState,
  player: PlayerSnapshot,
  buyer: ClubSnapshot,
  fee = player.marketValue.cents,
) {
  const seller = state.clubs.byId[player.clubId ?? ''];
  const squad = buyer.playerIds.flatMap((id) =>
    state.players.byId[id] ? [state.players.byId[id]!] : [],
  );
  const sellerSquad =
    seller?.playerIds.flatMap((id) => (state.players.byId[id] ? [state.players.byId[id]!] : [])) ??
    [];
  const policy = state.management?.policies?.[player.id];
  const human = state.participants.some((p) => p.clubId === seller?.id);
  const rival = seller ? isRival(buyer, seller) : false;
  const division = { A: 80, B: 65, C: 50, D: 35, REGIONAL: 30 };
  const leagueGap =
    (buyer.leagueStrength ?? division[buyer.division]) -
    (seller?.leagueStrength ?? (seller ? division[seller.division] : 35));
  const center = state.centers.byId[buyer.trainingCenterId];
  const projectSquad = [...squad].sort((a, b) => b.overall - a.overall).slice(0, 11);
  const strength =
    projectSquad.reduce((sum, p) => sum + p.overall, 0) / Math.max(1, projectSquad.length);
  const playerReasons = [
    { label: 'Projeto esportivo', value: 32 },
    { label: 'Força da liga', value: Math.round(leagueGap * (leagueGap < 0 ? 2.2 : 0.7)) },
    {
      label: 'Força do elenco',
      value: Math.round((strength - player.overall) * (strength < player.overall ? 3.2 : 0.5)),
    },
    {
      label: 'Concorrência na posição',
      value: -Math.min(
        45,
        squad.filter((p) => p.position === player.position && p.overall > player.overall).length *
          15,
      ),
    },
    {
      label: 'Estrutura e desenvolvimento',
      value: (center?.levels.scouting ?? 1) * 2 + (center?.levels.coaching ?? 1) * 2,
    },
    {
      label: 'Momento esportivo do clube',
      value: state.results
        .filter((r) => r.homeId === buyer.id || r.awayId === buyer.id)
        .slice(-3)
        .reduce(
          (sum, r) =>
            sum +
            ((r.homeId === buyer.id ? r.homeGoals > r.awayGoals : r.awayGoals > r.homeGoals)
              ? 4
              : -4),
          0,
        ),
    },
    {
      label: 'Compatibilidade com a elite',
      value: player.overall >= 86 && strength < player.overall - 10 ? -65 : 0,
    },
    { label: 'Problemas financeiros', value: (state.debts[buyer.id] ?? 0) > 0 ? -20 : 0 },
  ];
  const important = sellerSquad.filter((p) => p.overall > player.overall).length < 11;
  const clubReasons = [
    { label: 'Disposição para vender', value: human ? (policy?.interest ?? 35) : 55 },
    { label: 'Importância no elenco', value: important ? (player.overall >= 85 ? -55 : -25) : 10 },
    { label: 'Rivalidade regional', value: rival ? -30 : 0 },
    {
      label: 'Proposta em relação ao mercado',
      value: Math.max(
        -50,
        Math.min(80, Math.round((fee / Math.max(1000, player.marketValue.cents) - 1) * 80)),
      ),
    },
    {
      label: 'Necessidade financeira',
      value: seller && (state.debts[seller.id] ?? 0) > 0 ? 20 : 0,
    },
    {
      label: 'Negócios concluídos entre clubes',
      value: Math.min(
        20,
        state.negotiations.filter(
          (n) => n.buyerId === buyer.id && n.status === 'completed' && n.sellerId === seller?.id,
        ).length *
          5 +
          (state.management?.offers?.filter(
            (o) => o.buyerId === buyer.id && o.sellerId === seller?.id && o.status === 'accepted',
          ).length ?? 0) *
            5,
      ),
    },
  ];
  const blocked = Boolean(
    seller &&
    (seller.playerIds.length <= MIN_SQUAD_SIZE ||
      (human && ((!policy?.available && !policy?.loanAvailable) || (rival && !policy.rivals)))),
  );
  if (seller && seller.playerIds.length <= MIN_SQUAD_SIZE)
    clubReasons.push({ label: 'Elenco mínimo de 18 jogadores impede a saída', value: -100 });
  else if (blocked)
    clubReasons.push({ label: 'Política do treinador impede a venda', value: -100 });
  const playerInterest = Math.max(
    0,
    Math.min(
      100,
      playerReasons.reduce((sum, r) => sum + r.value, 0),
    ),
  );
  const clubInterest = !seller
    ? 100
    : blocked
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            clubReasons.reduce((sum, r) => sum + r.value, 0),
          ),
        );
  const baseClub = clubReasons
    .filter((r) => r.label !== 'Proposta em relação ao mercado')
    .reduce((sum, r) => sum + r.value, 0);
  return {
    playerInterest,
    clubInterest,
    blocked: blocked || (Boolean(seller) && clubInterest === 0) || playerInterest === 0,
    playerReasons,
    clubReasons,
    minimumFee: seller
      ? Math.min(
          Math.floor(player.marketValue.cents * 2),
          Math.max(
            Math.ceil(player.marketValue.cents * 0.15),
            ceilMoney(player.marketValue.cents * (1.55 - baseClub / 100)),
          ),
        )
      : 0,
    minimumSalary: Math.min(
      player.salary.cents * 3,
      ceilMoney(player.salary.cents * (1.65 - playerInterest / 100), MONEY_STEPS.salary),
    ),
  };
}
export function facilityLevels(state: WorldState, club: ClubSnapshot): Record<string, number> {
  const stadium = state.stadiums.byId[club.stadiumId],
    center = state.centers.byId[club.trainingCenterId];
  if (!stadium || !center) return {};
  return {
    ...center.levels,
    pitch: stadium.pitchLevel,
    surroundings: stadium.surroundingsLevel,
    structure: Math.max(...stadium.sectors.map((s) => s.level)),
    food: stadium.commerce.foodLevel,
    shirts: stadium.commerce.shirtsLevel,
    hospitality: stadium.commerce.hospitalityLevel,
  };
}
export function maintenanceBreakdown(state: WorldState, club: ClubSnapshot) {
  return facilityCosts(state, club);
}
export function temporaryModifiers(state: WorldState, player: PlayerSnapshot) {
  if (!player.clubId) return [];
  const clubId = player.clubId;
  const games = state.results
    .filter((r) => r.homeId === clubId || r.awayId === clubId)
    .slice(state.management?.contractHistory?.[player.id]?.effectsClubGames ?? 0);
  const won = (r: (typeof games)[number]) =>
    r.homeId === clubId ? r.homeGoals > r.awayGoals : r.awayGoals > r.homeGoals;
  let streak = 0;
  for (let i = games.length - 1; i >= 0 && won(games[i]!); i--) streak++;
  const effects: Array<{ label: string; value: number; until: string }> = [];
  const valuedGames = state.management?.contractHistory?.[player.id]?.valuedGames ?? 0;
  if (valuedGames > 0)
    effects.push({
      label: 'Sentido-se valorizado',
      value: 2,
      until: valuedGames + ' jogos restantes',
    });
  const cycleBonus =
    state.centers.byId[state.clubs.byId[clubId]?.trainingCenterId ?? '']?.operations
      ?.cycleBonuses?.[player.id]?.games ?? 0;
  if (cycleBonus > 0)
    effects.push({ label: 'Ciclo individual', value: 1, until: cycleBonus + ' jogos restantes' });
  const trainingBuff =
    state.centers.byId[state.clubs.byId[clubId]?.trainingCenterId ?? '']?.operations?.progression?.[
      player.id
    ]?.buff ?? 0;
  if (trainingBuff)
    effects.push({
      label: 'Bônus de treinamento',
      value: trainingBuff,
      until: 'Bônus conquistado nos treinos intensos',
    });
  const effort =
    state.centers.byId[state.clubs.byId[clubId]?.trainingCenterId ?? '']?.operations?.effort?.[
      player.id
    ] ?? 0;
  if (effort >= 5)
    effects.push({
      label: 'Sobrecarga de treinos',
      value: -Math.min(5, Math.floor(effort / 2)),
      until: 'Reduza a intensidade e descanse',
    });
  if (state.management?.contractHistory?.[player.id]?.dissatisfied)
    effects.push({
      label: 'Insatisfeito com o contrato',
      value: state.management?.contractHistory?.[player.id]?.severeDissatisfaction ? -10 : -8,
      until: 'Até renovar ou mudar de clube',
    });
  if (streak >= 3)
    effects.push({
      label: 'Boa fase do time',
      value: 1,
      until: 'Até a sequência de vitórias acabar',
    });
  if (
    (state.management?.contractHistory?.[player.id]?.effectsClubGames === undefined ||
      games.length > 0) &&
    (state.management?.wageDebts?.[clubId] ?? 0) > 0
  )
    effects.push({ label: 'Salário atrasado', value: -5, until: 'Até quitar a folha atrasada' });
  let winless = 0;
  for (let i = games.length - 1; i >= 0 && !won(games[i]!); i--) winless++;
  if (winless >= 3)
    effects.push({ label: 'Má fase do time', value: -1, until: 'Até a próxima vitória' });
  const ratings = state.ratingHistory
    .filter((entry) => entry.playerId === player.id)
    .slice(state.management?.contractHistory?.[player.id]?.effectsRatingCount ?? 0);
  const averageRating = ratings.length
    ? ratings.reduce((sum, entry) => sum + entry.rating, 0) / ratings.length
    : null;
  if (ratings.length >= 3 && averageRating !== null && averageRating < 6)
    effects.push({
      label: 'Má fase do jogador',
      value: -1,
      until: 'Até a média das notas chegar a 6',
    });
  if (ratings.length >= 4 && averageRating !== null && averageRating > 7)
    effects.push({
      label: 'Boa fase do jogador',
      value: 1,
      until: 'Enquanto a média das notas for maior que 7',
    });
  const last = games.at(-1);
  const own = state.clubs.byId[clubId],
    other = state.clubs.byId[last?.homeId === clubId ? (last.awayId ?? '') : (last?.homeId ?? '')];
  if (
    last &&
    won(last) &&
    ((own && other && isRival(own, other)) ||
      state.cups.some((c) => c.id === last.fixtureId && c.winnerId === clubId))
  )
    effects.push({ label: 'Vitória importante', value: 2, until: 'Até a próxima partida' });
  if ((state.workload[player.id]?.consecutiveMatches ?? 0) >= 3)
    effects.push({ label: 'Sequência de jogos', value: 1, until: 'Até deixar de atuar' });
  if (
    games.length >= 6 &&
    games
      .slice(-6)
      .every(
        (r) =>
          !r.lineups?.home.includes(player.id) &&
          !r.lineups?.away.includes(player.id) &&
          !(r.minutesPlayed?.[player.id] ?? 0) &&
          !r.substitutions?.some((substitution) => substitution.in === player.id),
      )
  )
    effects.push({ label: 'Sem sequência', value: -1, until: 'Até voltar a jogar' });
  const trophy = [...state.trophies]
    .reverse()
    .find((t) => t.clubId === clubId && t.season === state.season);
  if (trophy && games.length && games.filter((r) => (r.startedAt ?? 0) > trophy.wonAt).length < 3)
    effects.push({ label: 'Título conquistado', value: 3, until: 'Por três partidas do clube' });
  return effects;
}
export function effectiveOverall(state: WorldState, player: PlayerSnapshot) {
  return Math.max(
    1,
    Math.min(
      99,
      player.overall + temporaryModifiers(state, player).reduce((s, e) => s + e.value, 0),
    ),
  );
}
export const STYLE_ADVANTAGES: Record<PlayStyle, readonly PlayStyle[]> = {
  balanced: ['counter', 'all-out-press'],
  wings: ['low-block', 'balanced'],
  gegenpress: ['possession', 'wings'],
  'low-block': ['gegenpress', 'all-out-press'],
  possession: ['balanced', 'low-block'],
  counter: ['gegenpress', 'wings'],
  'all-out-press': ['possession', 'counter'],
};
export function tacticalBonus(
  style: PlayStyle,
  formation: Formation,
  opponent: PlayStyle,
  opposingFormation: Formation,
  players: readonly PlayerSnapshot[],
) {
  const roles: Record<PlayStyle, string[]> = {
    balanced: ['CM', 'CB'],
    wings: ['LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'LWB', 'RWB'],
    gegenpress: ['ST', 'CM', 'DM', 'LW', 'RW'],
    'all-out-press': ['ST', 'LW', 'RW', 'AM', 'CM', 'DM', 'LB', 'RB'],
    'low-block': ['CB', 'DM', 'GK'],
    possession: ['CM', 'DM', 'AM'],
    counter: ['ST', 'SS', 'LW', 'RW', 'AM'],
  };
  const key = players.filter((p) => roles[style].includes(p.position));
  const quality =
    key.reduce((s, p) => s + p.overall * (0.5 + p.fitness / 200), 0) / Math.max(1, key.length);
  const beats = STYLE_ADVANTAGES;
  const matchup =
    (beats[style].includes(opponent) ? 2 : 0) - (beats[opponent].includes(style) ? 2 : 0);
  const profile = (shape: Formation) => {
    const slots = FORMATIONS[shape];
    const count = (roles: string[]) => slots.filter((s) => roles.includes(s.position)).length;
    return {
      mid: count(['CM', 'DM', 'AM', 'SS']),
      attack: count(['LW', 'RW', 'ST', 'SS']),
      defense: count(['CB', 'LB', 'RB', 'LWB', 'RWB']),
      width: count(['LW', 'RW', 'LM', 'RM', 'LWB', 'RWB']),
      holding: count(['DM']),
      creators: count(['AM', 'CM', 'SS']),
    };
  };
  const a = profile(formation),
    b = profile(opposingFormation);
  const fit = (plan: PlayStyle, p: ReturnType<typeof profile>) => {
    switch (plan) {
      case 'balanced':
        return 1 - Math.abs(p.attack - 3) * 0.25 - Math.abs(p.defense - 4) * 0.25;
      case 'wings':
        return p.width * 0.3 - (p.width === 0 ? 0.75 : 0);
      case 'all-out-press':
        return (p.attack + p.mid) * 0.2 - (p.defense >= 5 ? 0.75 : 0);
      case 'gegenpress':
        return (p.attack + p.mid) * 0.2 - (p.defense >= 5 ? 0.5 : 0);
      case 'low-block':
        return (p.defense + p.holding) * 0.2 - (p.attack >= 4 ? 0.75 : 0);
      case 'possession':
        return (p.mid + p.creators) * 0.15 - (p.mid < 3 ? 0.5 : 0);
      case 'counter':
        return p.attack * 0.2 + p.holding * 0.2 - (p.attack < 2 ? 0.5 : 0);
    }
  };
  const shape = fit(style, a) - fit(opponent, b);
  const weakness =
    style === 'wings' && b.width === 0 ? 0.75 : opponent === 'wings' && a.width === 0 ? -0.75 : 0;
  const formationMatchup = Math.max(
    -1,
    Math.min(
      1,
      (a.mid * b.attack -
        b.mid * a.attack +
        a.attack * b.defense -
        b.attack * a.defense +
        a.defense * b.mid -
        b.defense * a.mid) /
        8,
    ),
  );
  return Math.max(
    -3,
    Math.min(
      3,
      (matchup + shape + weakness + formationMatchup) *
        Math.max(0.15, Math.min(1, (quality - 40) / 40)),
    ),
  );
}

export function manageClub({
  state,
  club,
  command,
  eventId,
}: CommandContext): Result<CommandOutcome> {
  if (command.type !== 'management')
    return failure(domainError('VALIDATION_ERROR', 'Comando inválido'));
  const fail = (message: string) => failure(domainError('VALIDATION_ERROR', message));
  const management = { ...state.management };
  const player = state.players.byId[command.playerId ?? ''];
  const done = (next: WorldState, message: string, amount = 0) =>
    success({ next, type: 'club.customized' as const, message, amount });
  if (command.action === 'counter-offer') {
    if (club.playerIds.length <= MIN_SQUAD_SIZE)
      return fail('O clube precisa manter pelo menos 18 jogadores');
    const fee = command.fee;
    if (!fee || !Number.isSafeInteger(fee)) return fail('Informe um valor válido');
    const human = state.negotiations.find(
      (n) => n.id === command.offerId && n.sellerId === club.id && n.status === 'review',
    );
    if (human) {
      if ((human.expiresAt ?? 0) <= state.lastProcessedAt || fee <= human.fee)
        return fail('A contraoferta deve superar a proposta vigente');
      return done(
        {
          ...state,
          negotiations: state.negotiations.map((n) =>
            n.id === human.id
              ? {
                  ...n,
                  fee,
                  status: 'salary' as const,
                  reply:
                    'O vendedor pede ' +
                    fee +
                    ' centavos. Confirme o valor para negociar com o atleta.',
                }
              : n,
          ),
        },
        'Contraoferta enviada ao comprador',
      );
    }
    const offer = management.offers?.find(
      (o) => o.id === command.offerId && o.sellerId === club.id && o.status === 'pending',
    );
    if (
      !offer ||
      offer.kind === 'loan' ||
      (offer.offeredAt ?? state.createdAt) + 14 * 86400000 <= state.lastProcessedAt ||
      fee <= offer.fee
    )
      return fail('Contraoferta indisponível');
    const buyer = state.clubs.byId[offer.buyerId];
    if (!buyer || state.players.byId[offer.playerId]?.clubId !== club.id)
      return fail('Proposta indisponível');
    const limits = financialLimits(state, buyer, fee);
    const accepted =
      fee <= offer.fee * 1.15 &&
      fee <= limits.transfer &&
      buyer.balance.cents >= fee + offer.salary &&
      offer.salary <= limits.salary;
    const next = {
      ...state,
      management: {
        ...management,
        offers: management.offers?.map((o) =>
          o.id === offer.id
            ? { ...o, fee, status: accepted ? ('pending' as const) : ('rejected' as const) }
            : o,
        ),
      },
    };
    if (!accepted) return done(next, 'O clube considerou o aumento alto e retirou a proposta');
    return done(next, 'O clube aceitou a contraoferta e atualizou o valor da proposta');
  }
  if (command.action === 'accept-transfer' || command.action === 'reject-transfer') {
    if (command.action === 'accept-transfer' && club.playerIds.length <= MIN_SQUAD_SIZE)
      return fail('O clube precisa manter pelo menos 18 jogadores');
    const offer = state.negotiations.find(
      (n) => n.id === command.offerId && n.sellerId === club.id && n.status === 'review',
    );
    if (
      !offer ||
      (offer.expiresAt ?? 0) <= state.lastProcessedAt ||
      state.players.byId[offer.playerId]?.clubId !== club.id
    )
      return fail('Proposta indisponível ou expirada');
    return done(
      {
        ...state,
        negotiations: state.negotiations.map((n) =>
          n.id === offer.id
            ? {
                ...n,
                status: command.action === 'accept-transfer' ? 'salary' : 'rejected',
                reply:
                  command.action === 'accept-transfer'
                    ? 'O técnico aceitou. Negociação com o jogador liberada.'
                    : 'O técnico recusou a transferência.',
              }
            : n,
        ),
      },
      command.action === 'accept-transfer'
        ? 'Conversa com o jogador liberada'
        : 'Proposta recusada',
    );
  }
  if (command.action === 'scout-academy')
    return done(prepareAcademy(state, club.id), 'Observação da base atualizada');
  if (command.action === 'dismiss-academy') {
    if (
      !player ||
      player.academyClubId !== club.id ||
      player.clubId ||
      player.academyDismissedSeason !== undefined ||
      player.academySeason !== state.season
    )
      return fail('Atleta indisponível na lista do Scout');
    return done(
      prepareAcademy(
        {
          ...state,
          players: {
            ...state.players,
            byId: {
              ...state.players.byId,
              [player.id]: { ...player, academyDismissedSeason: state.season },
            },
          },
          negotiations: state.negotiations.map((n) =>
            n.playerId === player.id && n.buyerId === club.id && n.status === 'salary'
              ? { ...n, status: 'rejected' as const }
              : n,
          ),
        },
        club.id,
      ),
      `${player.name} dispensado da base`,
    );
  }
  if (command.action === 'promote-academy') {
    if (player?.academyDismissedSeason !== undefined) return fail('Atleta dispensado da base');
    if (
      !player ||
      player.academyClubId !== club.id ||
      player.clubId ||
      player.academySeason !== state.season
    )
      return fail('Atleta indisponível na lista do Scout');
    if (club.playerIds.length >= MAX_SQUAD_SIZE)
      return fail('O elenco atingiu o limite de 45 jogadores');
    const salary = averageMonthlySalary(player.overall, player.age);
    const next: WorldState = {
      ...state,
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: {
            ...club,
            playerIds: [...club.playerIds, player.id],
            balance: { ...club.balance, cents: Math.max(0, club.balance.cents - salary) },
          },
        },
      },
      debts: {
        ...state.debts,
        [club.id]: (state.debts[club.id] ?? 0) + Math.max(0, salary - club.balance.cents),
      },
      players: {
        ...state.players,
        byId: {
          ...state.players.byId,
          [player.id]: {
            ...player,
            clubId: club.id,
            academyPromotedSeason: state.season,
            salary: { ...player.salary, cents: salary },
            shirtNumber:
              Array.from({ length: 99 }, (_, index) => index + 1).find(
                (number) =>
                  !club.playerIds.some((id) => state.players.byId[id]?.shirtNumber === number),
              ) ?? 99,
          },
        },
      },
      management: {
        ...state.management,
        contracts: {
          ...state.management?.contracts,
          [player.id]: state.lastProcessedAt + 3 * 365 * 86400000,
        },
        contractHistory: {
          ...state.management?.contractHistory,
          [player.id]: {
            overall: player.overall,
            marketValue: player.marketValue.cents,
            signedAt: state.lastProcessedAt,
            dissatisfied: false,
          },
        },
      },
      negotiations: state.negotiations.map((offer) =>
        offer.playerId === player.id && offer.buyerId === club.id && offer.status === 'salary'
          ? { ...offer, status: 'completed' as const, offeredSalary: salary }
          : offer,
      ),
    };
    return done(prepareAcademy(next, club.id), player.name + ' subiu para o profissional', -salary);
  }

  if (command.action === 'center') {
    const center = state.centers.byId[club.trainingCenterId];
    if (!center) return fail('Centro não encontrado');
    const operations = {
      load: 'moderate' as const,
      fitness: [] as string[],
      medical: [] as string[],
      individual: [] as { playerId: string; startedAt: number; endsAt: number }[],
      syringe: false,
      ...center.operations,
    };
    const target = (command.target ?? '').replace(/^player-load-/, '');
    let cost = 0;
    if (target === 'save-training') {
      const loads = command.playerLoads ?? {};
      if (Object.keys(loads).some((id) => state.players.byId[id]?.clubId !== club.id))
        return fail('Escolha apenas jogadores do seu elenco');
      operations.playerLoads = { ...operations.playerLoads, ...loads };
    } else if (['light', 'moderate', 'intense'].includes(target)) {
      if (!player || player.clubId !== club.id) return fail('Escolha um jogador do seu elenco');
      operations.playerLoads = {
        ...operations.playerLoads,
        [player.id]: target as 'light' | 'moderate' | 'intense',
      };
    } else if (target === 'buy-syringe') {
      if (center.levels.medical < 5 || operations.syringe || operations.clearance)
        return fail('Seringa indisponível ou já em estoque');
      if ((operations.syringeAvailableAt ?? 0) > state.lastProcessedAt)
        return fail('Aguarde a liberação da próxima compra de seringa');
      cost = CENTER_SERVICES.syringe;
      operations.syringe = true;
      operations.syringeAvailableAt = state.lastProcessedAt + CENTER_SERVICES.syringeCooldown;
    } else {
      if (!player || player.clubId !== club.id) return fail('Escolha um jogador do seu elenco');
      if (target === 'use-syringe') {
        if (center.levels.medical < 5 || !operations.syringe || !(state.injuries[player.id] ?? 0))
          return fail('Selecione um jogador lesionado e tenha uma seringa');
        const fixture = scheduledFixtures(state)
          .filter(
            (f) =>
              (f.homeId === club.id || f.awayId === club.id) &&
              !state.results.some((r) => r.fixtureId === f.id),
          )
          .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
        if (!fixture) return fail('Nenhuma partida pendente');
        operations.syringe = false;
        operations.clearance = { playerId: player.id, fixtureId: fixture.id };
      } else if (target === 'fitness' || target === 'medical') {
        const slots = Math.max(0, center.levels[target] - 2);
        if (operations[target].includes(player.id) || operations[target].length >= slots)
          return fail('Não há vagas disponíveis');
        if (target === 'medical' && (state.injuries[player.id] ?? 0) <= 1)
          return fail('O jogador precisa ter mais de um dia de lesão');
        if (target === 'fitness' && player.fitness >= 100)
          return fail('O jogador já está descansado');
        cost =
          target === 'fitness'
            ? CENTER_SERVICES.fitness
            : CENTER_SERVICES.medicalPerDay * (state.injuries[player.id] ?? 0);
        operations[target] = [...operations[target], player.id];
      } else if (target === 'individual') {
        if (
          operations.individual.length >= Math.min(3, center.levels.coaching) ||
          operations.individual.some((t) => t.playerId === player.id)
        )
          return fail('Treino indisponível para este jogador');
        cost = CENTER_SERVICES.individual;
        operations.individual = [
          ...operations.individual,
          {
            playerId: player.id,
            startedAt: state.lastProcessedAt,
            endsAt: state.lastProcessedAt + 60 * 86400000,
          },
        ];
      } else return fail('Função inválida');
    }
    if (club.balance.cents < cost) return fail('Saldo insuficiente');
    return done(
      {
        ...state,
        centers: {
          ...state.centers,
          byId: { ...state.centers.byId, [center.id]: { ...center, operations } },
        },
        clubs: {
          ...state.clubs,
          byId: {
            ...state.clubs.byId,
            [club.id]: { ...club, balance: { ...club.balance, cents: club.balance.cents - cost } },
          },
        },
      },
      'Centro de treinamento atualizado',
      -cost,
    );
  }
  if (command.action === 'offer-loan') {
    if (!player || !player.clubId || player.clubId === club.id || management.loans?.[player.id])
      return fail('Jogador indisponível');
    const seller = state.clubs.byId[player.clubId];
    const terms = loanTerms(state, player, club);
    if (!terms.available)
      return fail('Jogador indisponível para empréstimo pelas condições do contrato ou do clube');
    const months = command.months ?? 6;
    if (![6, 12].includes(months) || months > terms.maxMonths)
      return fail('Escolha 6 meses ou 1 temporada dentro do prazo autorizado');
    if ((command.salaryPercent ?? 50) < terms.minimumPercent)
      return fail('O técnico exige pelo menos ' + terms.minimumPercent + '% do salário');
    const salaryPercent = command.salaryPercent ?? 50;
    if (state.lastProcessedAt + months * 30 * 86400000 > contractEnd(state, player))
      return fail('O empréstimo não pode ultrapassar o contrato do jogador');
    if (
      state.participants.some((p) => p.clubId === seller?.id) &&
      !management.policies?.[player.id]?.loanAvailable
    )
      return fail('O clube não disponibilizou o jogador para empréstimo');
    if (club.playerIds.length >= MAX_SQUAD_SIZE || !seller) return fail('Elenco sem espaço');
    if (
      (management.offers ?? []).some(
        (o) => o.playerId === player.id && o.buyerId === club.id && o.status === 'pending',
      )
    )
      return fail('Já existe proposta pendente');
    const offer = {
      id: 'loan:' + eventId,
      playerId: player.id,
      sellerId: seller.id,
      buyerId: club.id,
      kind: 'loan' as const,
      months,
      salaryPercent,
      fee: 0,
      salary: ceilMoney((player.salary.cents * salaryPercent) / 100, MONEY_STEPS.salary),
      status: 'pending' as const,
      offeredAt: state.lastProcessedAt,
    };
    management.offers = [...(management.offers ?? []), offer];
    if (state.participants.some((p) => p.clubId === seller.id))
      return done({ ...state, management }, 'Proposta de empréstimo enviada');
    const loaned = acceptLoan({ ...state, management }, offer.id);
    return loaned
      ? done(loaned, 'Empréstimo contratado')
      : fail('O empréstimo ultrapassa o orçamento');
  }
  if (command.action === 'policy') {
    if (player?.clubId !== club.id) return fail('Escolha um jogador do seu elenco');
    if (state.management?.loans?.[player.id])
      return fail('Jogador emprestado não pode ser negociado');
    if (
      command.loanAvailable &&
      contractEnd(state, player) <= state.lastProcessedAt + 180 * 86400000
    )
      return fail('Empréstimo exige mais de 6 meses restantes de contrato');
    if (command.loanAvailable && !loanTerms(state, player).eligible)
      return fail('Empréstimos são reservados a reservas sem sequência e sem perfil de promessa');
    management.policies = {
      ...management.policies,
      [player.id]: {
        available: Boolean(command.available || command.loanAvailable),
        loanAvailable: command.loanAvailable ?? false,
        loanMonths: command.loanMonths ?? (loanTerms(state, player).maxMonths >= 12 ? 12 : 6),
        rivals: command.rivals ?? true,
        interest: command.interest ?? 75,
      },
    };
    return done({ ...state, management }, 'Disponibilidade para transferências atualizada');
  }
  if (command.action === 'reject-renewal') {
    if (!player || player.clubId !== club.id) return fail('Jogador não pertence ao clube');
    const terms = renewalTerms(state, player);
    if (!terms.demand) return fail('Não existe novo pedido de valorização');
    const record = management.contractHistory![player.id]!;
    const count = Math.min(3, (record.renewalRefusals ?? 0) + 1);
    const patience = renewalPatience(player);
    const final = count >= patience.refusals;
    management.contractHistory = {
      ...management.contractHistory,
      [player.id]: {
        ...record,
        dissatisfied: true,
        renewalRefusals: count,
        nextRequestAt: final ? 0 : state.lastProcessedAt + patience.retryDays * 86400000,
        refusesRenewal: final && terms.remaining <= 180,
        severeDissatisfaction: final && terms.remaining > 180,
      },
    };
    const next = {
      ...state,
      management,
      players: {
        ...state.players,
        byId: {
          ...state.players.byId,
          [player.id]: { ...player, morale: Math.max(0, player.morale - (final ? 12 : 8)) },
        },
      },
    };
    return done(
      next,
      final
        ? terms.remaining <= 180
          ? 'O jogador não renovará e sairá ao fim do contrato.'
          : 'Pedido recusado novamente: jogador insatisfeito (−10)'
        : 'Pedido recusado: jogador insatisfeito (−8)',
    );
  }
  if (command.action === 'renew') {
    if (!player || player.clubId !== club.id) return fail('Jogador não pertence ao clube');
    const totalYears = command.years ?? 1;
    const terms = renewalTerms(state, player, totalYears);
    if (terms.reason) return fail(terms.reason);
    if (totalYears > terms.maxYears)
      return fail(
        'O jogador recusa um contrato tão longo. Prazo total máximo: ' +
          terms.maxYears +
          ' ano(s).',
      );
    if (totalYears * 365 < terms.remaining)
      return fail('O prazo não pode reduzir o contrato atual');
    if (management.loans?.[player.id])
      return fail('Renove com o clube de origem após o empréstimo');
    const minimum = terms.minimumSalary;
    if (!command.salary || command.salary < minimum)
      return fail('Reajuste necessário: salário mínimo mensal de R$ ' + formatMoney(minimum));
    if (command.salary > financialLimits(state, club).salary + player.salary.cents)
      return fail('A renovação ultrapassa o limite da folha salarial');
    management.contractHistory = {
      ...management.contractHistory,
      [player.id]: {
        ...management.contractHistory?.[player.id],
        renewalRefusals: 0,
        nextRequestAt: 0,
        refusesRenewal: false,
        severeDissatisfaction: false,
        overall: player.overall,
        marketValue: player.marketValue.cents,
        signedAt: state.lastProcessedAt,
        dissatisfied: false,
        valuedGames:
          !terms.demand && command.salary > player.salary.cents
            ? 5
            : (management.contractHistory?.[player.id]?.valuedGames ?? 0),
      },
    };
    management.contracts = {
      ...management.contracts,
      [player.id]: Math.max(
        contractEnd(state, player),
        state.lastProcessedAt + (command.years ?? 1) * 365 * 86400000,
      ),
    };
    return done(
      {
        ...state,
        management,
        players: {
          ...state.players,
          byId: {
            ...state.players.byId,
            [player.id]: {
              ...player,
              morale: Math.min(
                100,
                player.morale +
                  (state.management?.contractHistory?.[player.id]?.dissatisfied ? 12 : 6),
              ),
              salary: { ...player.salary, cents: command.salary },
            },
          },
        },
      },
      'Contrato de ' + player.name + ' renovado',
    );
  }
  if (command.action === 'pay-debt') {
    const debt = state.debts[club.id] ?? 0;
    if (debt > club.balance.cents) return fail('Caixa insuficiente para quitar os atrasados');
    management.wageDebts = { ...management.wageDebts, [club.id]: 0 };
    return done(
      {
        ...state,
        management,
        debts: { ...state.debts, [club.id]: 0 },
        clubs: {
          ...state.clubs,
          byId: {
            ...state.clubs.byId,
            [club.id]: { ...club, balance: { ...club.balance, cents: club.balance.cents - debt } },
          },
        },
      },
      'Pendências mensais quitadas',
      -debt,
    );
  }
  if (command.action === 'sell-facility') {
    const target = command.target ?? '',
      level = facilityLevels(state, club)[target];
    if (!level || level <= 1) return fail('O nível básico não pode ser vendido');
    const stadium = state.stadiums.byId[club.stadiumId]!,
      center = state.centers.byId[club.trainingCenterId]!;
    let nextStadium = stadium,
      nextCenter = center;
    if (
      target in center.levels &&
      center.operations &&
      (target === 'fitness' || target === 'medical'
        ? center.operations[target].length > Math.max(0, level - 3)
        : target === 'coaching'
          ? center.operations.individual.length > Math.min(3, level - 1)
          : false)
    )
      return fail('Aguarde os atendimentos terminarem antes de reduzir as vagas');
    if (target === 'medical' && (center.operations?.syringe || center.operations?.clearance))
      return fail('Use a seringa e aguarde a partida antes de vender este nível');
    if (target in center.levels)
      nextCenter = { ...center, levels: { ...center.levels, [target]: level - 1 } };
    else if (target === 'structure')
      nextStadium = {
        ...stadium,
        sectors: stadium.sectors.map((s) => ({
          ...s,
          level: Math.max(1, s.level - 1),
          capacity: Math.max(1, s.capacity - GAMEPLAY.upgradeCapacity),
        })),
      };
    else if (target === 'pitch' || target === 'surroundings')
      nextStadium = {
        ...stadium,
        [target === 'pitch' ? 'pitchLevel' : 'surroundingsLevel']: level - 1,
      };
    else
      nextStadium = {
        ...stadium,
        commerce: { ...stadium.commerce, [target + 'Level']: level - 1 },
      };
    const refund = roundMoney(upgradePrice(level - 1, target) * 0.5);
    return done(
      {
        ...state,
        clubs: {
          ...state.clubs,
          byId: {
            ...state.clubs.byId,
            [club.id]: {
              ...club,
              balance: { ...club.balance, cents: club.balance.cents + refund },
            },
          },
        },
        stadiums: {
          ...state.stadiums,
          byId: { ...state.stadiums.byId, [stadium.id]: nextStadium },
        },
        centers: { ...state.centers, byId: { ...state.centers.byId, [center.id]: nextCenter } },
      },
      'Estrutura vendida; bônus e manutenção reduzidos',
      refund,
    );
  }
  const offer = management.offers?.find(
    (o) =>
      o.id === command.offerId &&
      o.sellerId === club.id &&
      o.status === 'pending' &&
      (o.offeredAt ?? state.createdAt) + 14 * 86400000 > state.lastProcessedAt,
  );
  if (!offer) return fail('Proposta indisponível');
  if (command.action === 'reject')
    return done(
      {
        ...state,
        management: {
          ...management,
          offers: management.offers?.map((o) =>
            o.id === offer.id ? { ...o, status: 'rejected' } : o,
          ),
        },
      },
      'Proposta recusada',
    );
  if (offer.kind === 'loan') {
    const loaned = acceptLoan(state, offer.id);
    return loaned
      ? done(loaned, 'Empréstimo confirmado')
      : fail('Empréstimo indisponível: confira contrato, elenco e orçamento');
  }
  const sold = state.players.byId[offer.playerId],
    buyer = state.clubs.byId[offer.buyerId];
  if (club.playerIds.length <= MIN_SQUAD_SIZE)
    return fail('O clube precisa manter pelo menos 18 jogadores');
  if (!sold || sold.clubId !== club.id || !buyer || buyer.balance.cents < offer.fee + offer.salary)
    return fail('A proposta não pode mais ser concluída');
  if (buyer.playerIds.length >= MAX_SQUAD_SIZE)
    return fail('O comprador atingiu o limite de 45 jogadores');
  const buyerLimits = financialLimits(state, buyer, offer.fee);
  if (offer.fee > buyerLimits.transfer || offer.salary > buyerLimits.salary)
    return fail('O comprador não possui orçamento disponível');
  const buyerPlan = management.financialPlans?.[buyer.id];
  if (buyerPlan)
    management.financialPlans = {
      ...management.financialPlans,
      [buyer.id]: { ...buyerPlan, transfer: Math.max(0, buyerPlan.transfer - offer.fee) },
    };
  // Accepting an unsolicited bid is explicit permission to sell this player.
  const context = transferContext(
    {
      ...state,
      management: {
        ...management,
        policies: {
          ...management.policies,
          [sold.id]: {
            rivals: true,
            interest: 75,
            ...management.policies?.[sold.id],
            available: true,
          },
        },
      },
    },
    sold,
    buyer,
    offer.fee,
  );
  if (context.blocked) return fail('A política atual impede esta transferência');
  management.offers = management.offers?.map((o) =>
    o.id === offer.id ? { ...o, status: 'accepted' } : o,
  );
  management.policies = {
    ...management.policies,
    [sold.id]: { available: false, rivals: false, interest: 35 },
  };
  management.contracts = {
    ...management.contracts,
    [sold.id]: state.lastProcessedAt + 3 * 365 * 86400000,
  };
  return done(
    {
      ...state,
      management,
      players: {
        ...state.players,
        byId: {
          ...state.players.byId,
          [sold.id]: { ...sold, clubId: buyer.id, salary: { ...sold.salary, cents: offer.salary } },
        },
      },
      clubs: {
        ...state.clubs,
        byId: {
          ...state.clubs.byId,
          [club.id]: {
            ...club,
            playerIds: club.playerIds.filter((id) => id !== sold.id),
            balance: { ...club.balance, cents: club.balance.cents + offer.fee },
          },
          [buyer.id]: {
            ...buyer,
            playerIds: [...buyer.playerIds, sold.id],
            balance: { ...buyer.balance, cents: buyer.balance.cents - offer.fee - offer.salary },
          },
        },
      },
    },
    sold.name + ' vendido para ' + buyer.name,
    offer.fee,
  );
}

export function settleMonthly(state: WorldState, at: number): WorldState {
  const currentDate = new Date(state.lastProcessedAt - 10800000);
  if (at < Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 1, 3))
    return state;
  const management = { ...state.management };
  const charges = [...(management.charges ?? [])];
  let clubs = { ...state.clubs.byId };
  const debts = { ...state.debts };
  const wageDebts = { ...management.wageDebts };
  // Calendar boundaries use Brasília's fixed UTC-3, including skipped months.
  const date = new Date(state.lastProcessedAt - 10800000);
  let boundary = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 3);
  while (boundary <= at) {
    state = returnLoans({ ...state, clubs: { ...state.clubs, byId: clubs } }, boundary);
    clubs = { ...state.clubs.byId };
    management.loans = state.management?.loans;
    const month = new Date(boundary - 10800000).toISOString().slice(0, 7);
    for (const original of Object.values(clubs)) {
      if (charges.some((c) => c.clubId === original.id && c.month === month)) continue;
      const wages = roundMoney(
        original.playerIds.reduce((sum, id) => sum + loanWage(state, id, original.id), 0),
      );
      const retainedWages = Object.entries(state.management?.loans ?? {}).reduce(
        (sum, [id, loan]) =>
          sum + (loan.ownerId === original.id ? loanWage(state, id, original.id) : 0),
        0,
      );
      const maintenance = roundMoney(
        maintenanceBreakdown(state, original).reduce((sum, item) => sum + item.cost, 0),
      );
      const oldDebt = debts[original.id] ?? 0;
      const owed = oldDebt + wages + retainedWages + maintenance;
      const paid = Math.min(original.balance.cents, owed);
      debts[original.id] = roundMoney(owed - paid);
      // Settle old salary arrears first, then this month's salaries, then maintenance.
      wageDebts[original.id] = roundMoney(
        Math.max(0, (wageDebts[original.id] ?? 0) + wages + retainedWages - paid),
      );
      clubs[original.id] = {
        ...original,
        balance: { ...original.balance, cents: roundMoney(original.balance.cents - paid) },
      };
      charges.push({
        clubId: original.id,
        month,
        wages: wages + retainedWages,
        maintenance,
        unpaid: debts[original.id]!,
      });
    }
    const next = new Date(boundary);
    boundary = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 1, 3);
  }
  return {
    ...state,
    clubs: { ...state.clubs, byId: clubs },
    debts,
    management: { ...management, charges, wageDebts },
  };
}
export function generateIncomingOffers(state: WorldState): WorldState {
  // Stable per round so retries cannot reroll interest or create extra offers.
  const interest = (key: string) => {
    let hash = 2166136261;
    for (const char of `${state.createdAt}:${state.round}:${key}`) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x45d9f3b);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
  const offers = (state.management?.offers ?? []).map((offer) =>
    offer.status === 'pending' &&
    (state.clubs.byId[offer.sellerId]?.playerIds.length ?? 0) <= MIN_SQUAD_SIZE
      ? { ...offer, status: 'rejected' as const }
      : offer,
  );
  const humanClubIds = new Set(state.participants.map((p) => p.clubId));
  const buyers = Object.values(state.clubs.byId)
    .filter((b) => !humanClubIds.has(b.id))
    .sort((a, b) => b.balance.cents - a.balance.cents);
  for (const member of state.participants) {
    const seller = state.clubs.byId[member.clubId];
    if (!seller || seller.playerIds.length <= MIN_SQUAD_SIZE) continue;
    const activity = interest(`activity:${seller.id}`);
    const limit = activity < 0.55 ? 0 : activity < 0.85 ? 1 : activity < 0.97 ? 2 : 3;
    let generated = offers.filter(
      (o) =>
        o.sellerId === seller.id &&
        (o.id.startsWith(`offer:${state.round}:`) || o.id.startsWith(`loan:${state.round}:`)),
    ).length;
    const candidates = [...seller.playerIds].sort(
      (a, b) => interest(`order:${a}`) - interest(`order:${b}`),
    );
    for (const id of candidates) {
      if (generated >= limit) break;
      const player = state.players.byId[id];
      const policy = state.management?.policies?.[id];
      if (!player || state.management?.loans?.[id]) continue;
      const unsolicited = !policy?.available && !policy?.loanAvailable;
      // One rare club-level opportunity avoids multiplying the chance by squad size.
      if (unsolicited && interest(`unsolicited:${seller.id}`) >= 0.08) continue;
      if (offers.some((o) => o.playerId === id && o.status === 'pending')) continue;
      if (interest(`player:${id}`) > (unsolicited ? 0.06 : 0.4)) continue;
      // Let interest cool after a proposal, including rejected or expired offers.
      if (
        offers.some(
          (o) => o.playerId === id && (o.offeredAt ?? 0) > state.lastProcessedAt - 7 * 86400000,
        )
      )
        continue;
      for (const buyer of buyers) {
        const positionPlayers = buyer.playerIds.flatMap((pid) => {
          const p = state.players.byId[pid];
          return p?.position === player.position ? [p] : [];
        });
        if (positionPlayers.length >= 2 && positionPlayers.some((p) => p.overall >= player.overall))
          continue;
        if (buyer.playerIds.length >= MAX_SQUAD_SIZE) continue;
        if (policy?.loanAvailable) {
          if (!loanTerms(state, player, buyer).eligible) continue;
          const maxMonths = Math.min(
            60,
            Math.floor((contractEnd(state, player) - state.lastProcessedAt) / (30 * 86400000)),
          );
          if (maxMonths < 6) continue;
          const salaryPercent = Math.max(
            loanTerms(state, player, buyer).minimumPercent,
            ([50, 75, 100] as const)[(state.round + player.age) % 3]!,
          ) as 50 | 75 | 100;
          const salary = ceilMoney((player.salary.cents * salaryPercent) / 100, MONEY_STEPS.salary);
          if (salary > financialLimits(state, buyer).salary) continue;
          offers.push({
            id: 'loan:' + state.round + ':' + id + ':' + buyer.id,
            playerId: id,
            buyerId: buyer.id,
            sellerId: seller.id,
            kind: 'loan',
            months: Math.min(maxMonths, policy.loanMonths ?? 12) >= 12 ? 12 : 6,
            salaryPercent,
            fee: 0,
            salary,
            status: 'pending',
            offeredAt: state.lastProcessedAt,
          });
          generated++;
          break;
        }
        const context = transferContext(
          unsolicited
            ? {
                ...state,
                management: {
                  ...state.management,
                  policies: {
                    ...state.management?.policies,
                    [id]: { rivals: true, interest: 75, ...policy, available: true },
                  },
                },
              }
            : state,
          player,
          buyer,
        );
        if (context.blocked) continue;
        const fee = unsolicited
            ? ceilMoney(
                Math.max(
                  context.minimumFee,
                  player.marketValue.cents * (1.25 + interest(`premium:${id}`) * 0.25),
                ),
                MONEY_STEPS.transfer,
              )
            : context.minimumFee,
          salary = context.minimumSalary;
        const payroll = buyer.playerIds.reduce(
          (sum, pid) => sum + (state.players.byId[pid]?.salary.cents ?? 0),
          0,
        );
        if (
          buyer.balance.cents -
            offers
              .filter((o) => o.buyerId === buyer.id && o.status === 'pending')
              .reduce((sum, o) => sum + o.fee + o.salary, 0) <
            fee + salary + payroll * 2 ||
          (state.debts[buyer.id] ?? 0) > 0
        )
          continue;
        offers.push({
          id: 'offer:' + state.round + ':' + id + ':' + buyer.id,
          playerId: id,
          buyerId: buyer.id,
          sellerId: seller.id,
          fee,
          salary,
          status: 'pending',
          offeredAt: state.lastProcessedAt,
        });
        generated++;
        break;
      }
    }
  }
  return { ...state, management: { ...state.management, offers } };
}

/** The stored salary remains the full wage; both clubs pay their rounded share. */
export function loanWage(state: WorldState, playerId: string, clubId: string): number {
  const player = state.players.byId[playerId];
  if (!player) return 0;
  const loan = state.management?.loans?.[playerId];
  if (!loan) return player.clubId === clubId ? player.salary.cents : 0;
  const share = Math.min(
    player.salary.cents,
    ceilMoney((player.salary.cents * loan.salaryPercent) / 100, MONEY_STEPS.salary),
  );
  return clubId === loan.borrowerId
    ? share
    : clubId === loan.ownerId
      ? player.salary.cents - share
      : 0;
}
function acceptLoan(state: WorldState, offerId: string): WorldState | undefined {
  const offer = state.management?.offers?.find((o) => o.id === offerId && o.status === 'pending');
  if (!offer || offer.kind !== 'loan') return;
  const player = state.players.byId[offer.playerId];
  const owner = state.clubs.byId[offer.sellerId],
    borrower = state.clubs.byId[offer.buyerId];
  const endsAt = state.lastProcessedAt + (offer.months ?? 6) * 30 * 86400000;
  if (
    !player ||
    !owner ||
    (owner && owner.playerIds.length <= MIN_SQUAD_SIZE) ||
    !borrower ||
    player.clubId !== owner.id ||
    !loanTerms(state, player, borrower).eligible ||
    ![6, 12].includes(offer.months ?? 6) ||
    (offer.months ?? 6) > loanTerms(state, player, borrower).maxMonths ||
    (offer.salaryPercent ?? 50) < loanTerms(state, player, borrower).minimumPercent ||
    (offer.offeredAt ?? state.createdAt) + 14 * 86400000 <= state.lastProcessedAt ||
    state.management?.loans?.[player.id] ||
    borrower.playerIds.length >= MAX_SQUAD_SIZE ||
    endsAt > contractEnd(state, player) ||
    (!state.management?.policies?.[player.id]?.loanAvailable &&
      state.participants.some((p) => p.clubId === owner.id)) ||
    borrower.balance.cents < offer.salary ||
    offer.salary > financialLimits(state, borrower).salary
  )
    return;
  return {
    ...state,
    management: {
      ...state.management,
      loans: {
        ...state.management?.loans,
        [player.id]: {
          ownerId: owner.id,
          borrowerId: borrower.id,
          endsAt,
          salaryPercent: offer.salaryPercent ?? 50,
        },
      },
      offers: state.management?.offers?.map((o) =>
        o.playerId === player.id && o.status === 'pending'
          ? { ...o, status: o.id === offer.id ? 'accepted' : 'rejected' }
          : o,
      ),
      policies: {
        ...state.management?.policies,
        [player.id]: { available: false, loanAvailable: false, rivals: true, interest: 75 },
      },
    },
    players: {
      ...state.players,
      byId: { ...state.players.byId, [player.id]: { ...player, clubId: borrower.id } },
    },
    clubs: {
      ...state.clubs,
      byId: {
        ...state.clubs.byId,
        [owner.id]: { ...owner, playerIds: owner.playerIds.filter((id) => id !== player.id) },
        [borrower.id]: { ...borrower, playerIds: [...borrower.playerIds, player.id] },
      },
    },
  };
}
export function returnLoans(state: WorldState, at: number): WorldState {
  const due = Object.entries(state.management?.loans ?? {}).filter(([, loan]) => loan.endsAt <= at);
  if (!due.length) return state;
  const loans = { ...state.management?.loans };
  const players = { ...state.players.byId },
    clubs = { ...state.clubs.byId };
  for (const [id, loan] of due) {
    const player = players[id],
      owner = clubs[loan.ownerId],
      borrower = clubs[loan.borrowerId];
    if (!player || !owner || !borrower) continue;
    players[id] = { ...player, clubId: owner.id };
    clubs[owner.id] = { ...owner, playerIds: [...new Set([...owner.playerIds, id])] };
    clubs[borrower.id] = { ...borrower, playerIds: borrower.playerIds.filter((pid) => pid !== id) };
    delete loans[id];
  }
  return {
    ...state,
    management: { ...state.management, loans },
    players: { ...state.players, byId: players },
    clubs: { ...state.clubs, byId: clubs },
  };
}

export function loanTerms(state: WorldState, player: PlayerSnapshot, buyer?: ClubSnapshot) {
  const seller = state.clubs.byId[player.clubId ?? ''];
  const squad =
    seller?.playerIds.flatMap((id) => (state.players.byId[id] ? [state.players.byId[id]!] : [])) ??
    [];
  const better = squad.filter((p) => p.overall > player.overall).length;
  const average = squad.reduce((sum, p) => sum + p.overall, 0) / Math.max(1, squad.length);
  const prospect = player.age <= 23 && player.potential >= player.overall + 8;
  const sequence = state.workload[player.id]?.consecutiveMatches ?? 0;
  const shape = seller ? (state.tactics[seller.id]?.formation ?? '4-3-3') : '4-3-3';
  const rolePlaces = Math.max(
    1,
    FORMATIONS[shape].filter((slot) => slot.position === player.position).length,
  );
  const roleRank = squad.filter(
    (p) => p.position === player.position && p.overall > player.overall,
  ).length;
  let recentStarts = 0,
    recentGames = 0;
  for (let i = state.results.length - 1; i >= 0 && recentGames < 5; i--) {
    const match = state.results[i]!;
    if (match.homeId !== seller?.id && match.awayId !== seller?.id) continue;
    recentGames++;
    const side = match.homeId === seller?.id ? 'home' : 'away';
    if ((match.lineups?.[side] ?? match.tacticalPlans?.[side]?.starters ?? []).includes(player.id))
      recentStarts++;
  }
  const buyerAverage = buyer
    ? buyer.playerIds.reduce((sum, id) => sum + (state.players.byId[id]?.overall ?? 0), 0) /
      Math.max(1, buyer.playerIds.length)
    : 100;
  const humanOwner = state.participants.some((p) => p.clubId === seller?.id);
  const aiEligible =
    !!seller &&
    (!buyer || player.overall <= buyerAverage + 12) &&
    better >= 11 &&
    roleRank >= rolePlaces &&
    !state.tactics[seller.id]?.starters.includes(player.id) &&
    recentStarts < 3 &&
    player.overall <= average &&
    !prospect &&
    sequence < 3;
  const eligible =
    !!seller &&
    seller.playerIds.length > MIN_SQUAD_SIZE &&
    (humanOwner || aiEligible) &&
    contractEnd(state, player) - state.lastProcessedAt > 180 * 86400000 &&
    !state.management?.loans?.[player.id];
  const willingness =
    50 +
    (average - player.overall) * 3 +
    (sequence === 0 ? 15 : 0) -
    (buyer && seller && isRival(buyer, seller) ? 20 : 0);
  const minimumPercent = willingness >= 70 ? 50 : willingness >= 45 ? 75 : 100;
  const maxMonths = Math.min(
    buyer ? (state.management?.policies?.[player.id]?.loanMonths ?? 12) : 12,
    Math.floor((contractEnd(state, player) - state.lastProcessedAt) / (30 * 86400000)),
  );
  return {
    eligible: eligible && maxMonths >= 6,
    available:
      eligible &&
      maxMonths >= 6 &&
      (!humanOwner || !!state.management?.policies?.[player.id]?.loanAvailable) &&
      (!buyer ||
        !transferContext(state, player, buyer).blocked ||
        !!state.management?.policies?.[player.id]?.available ||
        !!state.management?.policies?.[player.id]?.loanAvailable),
    minimumPercent,
    maxMonths,
  };
}
