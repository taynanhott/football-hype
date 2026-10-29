import { stableId } from './world-factory.js';
import { prepareAcademy } from './academy.js';
import { scheduledFixtures } from '../competitions/fixtures.js';
import { upgradePrice, facilityCosts } from '../finance/facility-costs.js';
export { upgradePrice, maintenanceForLevel } from '../finance/facility-costs.js';
import {
  GAMEPLAY,
  MAX_SQUAD_SIZE,
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
  return (
    state.management?.contracts?.[player.id] ??
    state.createdAt +
      (1 + (player.id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % 3)) * 365 * 86400000
  );
}
export function interestLabel(score: number) {
  return score <= 0
    ? 'Nenhum interesse'
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
  const strength = squad.reduce((sum, p) => sum + p.overall, 0) / Math.max(1, squad.length);
  const playerReasons = [
    { label: 'Projeto esportivo', value: 40 },
    { label: 'Força da liga', value: Math.round(leagueGap * 0.95) },
    { label: 'Força do elenco', value: Math.round((strength - player.overall) * 0.95) },
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
  const blocked = Boolean(seller && human && (!policy?.available || (rival && !policy.rivals)));
  if (blocked) clubReasons.push({ label: 'Política do treinador impede a venda', value: -100 });
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
    blocked: blocked || clubInterest === 0 || playerInterest === 0,
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
  const games = state.results.filter((r) => r.homeId === clubId || r.awayId === clubId);
  const won = (r: (typeof games)[number]) =>
    r.homeId === clubId ? r.homeGoals > r.awayGoals : r.awayGoals > r.homeGoals;
  let streak = 0;
  for (let i = games.length - 1; i >= 0 && won(games[i]!); i--) streak++;
  const effects: Array<{ label: string; value: number; until: string }> = [];
  if (streak >= 3)
    effects.push({
      label: 'Boa fase do time',
      value: 1,
      until: 'Até a sequência de vitórias acabar',
    });
  if ((state.management?.wageDebts?.[clubId] ?? 0) > 0)
    effects.push({ label: 'Salário atrasado', value: -5, until: 'Até quitar a folha atrasada' });
  const lastDefeat = games.some((r) => !won(r) && r.homeGoals !== r.awayGoals) ? 0 : -1;
  if (lastDefeat >= 0 && streak < 3)
    effects.push({ label: 'Má fase do time', value: -1, until: 'Até três vitórias seguidas' });
  const ratings = state.ratingHistory.filter((entry) => entry.playerId === player.id);
  const averageRating = ratings.length
    ? ratings.reduce((sum, entry) => sum + entry.rating, 0) / ratings.length
    : null;
  if (averageRating !== null && averageRating < 6)
    effects.push({
      label: 'Má fase do jogador',
      value: -1,
      until: 'Até a média das notas chegar a 6',
    });
  if (averageRating !== null && averageRating > 7)
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
    games.length >= 5 &&
    games
      .slice(-5)
      .every((r) => !r.lineups?.home.includes(player.id) && !r.lineups?.away.includes(player.id))
  )
    effects.push({ label: 'Sem sequência', value: -1, until: 'Até voltar a jogar' });
  const trophy = [...state.trophies]
    .reverse()
    .find((t) => t.clubId === clubId && t.season === state.season);
  if (trophy && games.filter((r) => (r.startedAt ?? 0) > trophy.wonAt).length < 3)
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
export function tacticalBonus(
  style: PlayStyle,
  formation: Formation,
  opponent: PlayStyle,
  opposingFormation: Formation,
  players: readonly PlayerSnapshot[],
) {
  const roles: Record<PlayStyle, string[]> = {
    balanced: ['CM', 'CB'],
    wings: ['LW', 'RW', 'LM', 'RM', 'LB', 'RB'],
    gegenpress: ['ST', 'CM', 'DM', 'LW', 'RW'],
    'low-block': ['CB', 'DM', 'GK'],
    possession: ['CM', 'DM', 'AM'],
    counter: ['ST', 'LW', 'RW', 'AM'],
  };
  const key = players.filter((p) => roles[style].includes(p.position));
  const quality =
    key.reduce((s, p) => s + p.overall * (0.5 + p.fitness / 200), 0) / Math.max(1, key.length);
  const beats: Record<PlayStyle, PlayStyle[]> = {
    balanced: ['counter'],
    wings: ['low-block'],
    gegenpress: ['possession'],
    'low-block': ['gegenpress'],
    possession: ['balanced', 'low-block'],
    counter: ['gegenpress', 'wings'],
  };
  const matchup =
    (beats[style].includes(opponent) ? 2 : 0) - (beats[opponent].includes(style) ? 2 : 0);
  const shape =
    style === 'wings' && ['4-3-3', '3-4-3', '4-2-4'].includes(formation)
      ? 1
      : style === 'low-block' && formation === '5-3-2'
        ? 1
        : 0;
  const weakness = style === 'wings' && ['4-3-1-2', '3-4-1-2'].includes(opposingFormation) ? 1 : 0;
  const profile = (shape: Formation) => {
    const slots = FORMATIONS[shape];
    return {
      mid: slots.filter((s) => ['CM', 'DM', 'AM'].includes(s.position)).length,
      attack: slots.filter((s) => ['LW', 'RW', 'ST'].includes(s.position)).length,
      defense: slots.filter((s) => ['CB', 'LB', 'RB'].includes(s.position)).length,
    };
  };
  const a = profile(formation),
    b = profile(opposingFormation);
  const formationMatchup = Math.max(
    -1,
    Math.min(
      1,
      (a.mid * b.attack -
        b.mid * a.attack +
        (a.attack * b.defense - b.attack * a.defense) +
        (a.defense * b.mid - b.defense * a.mid)) /
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

export function manageClub({ state, club, command }: CommandContext): Result<CommandOutcome> {
  if (command.type !== 'management')
    return failure(domainError('VALIDATION_ERROR', 'Comando inválido'));
  const fail = (message: string) => failure(domainError('VALIDATION_ERROR', message));
  const management = { ...state.management };
  const player = state.players.byId[command.playerId ?? ''];
  const done = (next: WorldState, message: string, amount = 0) =>
    success({ next, type: 'club.customized' as const, message, amount });
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
    if (
      state.negotiations.some(
        (n) => n.playerId === player.id && n.buyerId === club.id && n.status === 'salary',
      )
    )
      return done(state, 'Negociação salarial em andamento');
    return done(
      {
        ...state,
        negotiations: [
          ...state.negotiations,
          {
            id: stableId(84, state.negotiations.length + 1),
            buyerId: club.id,
            playerId: player.id,
            fee: 0,
            offeredSalary: null,
            interest: 100,
            status: 'salary',
            minimumSalary: player.salary.cents,
            reply: 'Vamos conversar sobre meu primeiro contrato profissional.',
          },
        ],
      },
      'Negociação salarial iniciada',
    );
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
    const target = command.target ?? '';
    let cost = 0;
    if (['light', 'moderate', 'intense'].includes(target))
      operations.load = target as typeof operations.load;
    else if (target === 'buy-syringe') {
      if (center.levels.medical < 5 || operations.syringe || operations.clearance)
        return fail('Seringa indisponível ou já em estoque');
      cost = 15000000;
      operations.syringe = true;
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
        if (target === 'medical' && !(state.injuries[player.id] ?? 0))
          return fail('O jogador não está lesionado');
        if (target === 'fitness' && player.fitness >= 100)
          return fail('O jogador já está descansado');
        cost = target === 'fitness' ? 2500000 : 5000000;
        operations[target] = [...operations[target], player.id];
      } else if (target === 'individual') {
        if (
          operations.individual.length >= Math.min(3, center.levels.coaching) ||
          operations.individual.some((t) => t.playerId === player.id) ||
          player.overall >= 99
        )
          return fail('Treino indisponível para este jogador');
        cost = 10000000;
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
  if (command.action === 'policy') {
    if (player?.clubId !== club.id) return fail('Escolha um jogador do seu elenco');
    management.policies = {
      ...management.policies,
      [player.id]: {
        available: command.available ?? false,
        rivals: command.rivals ?? false,
        interest: command.interest ?? 35,
      },
    };
    return done({ ...state, management }, 'Disponibilidade para transferências atualizada');
  }
  if (command.action === 'renew') {
    if (!player || player.clubId !== club.id) return fail('Jogador não pertence ao clube');
    if (player.morale < 30) return fail('O jogador recusa renovar por falta de moral com o clube');
    if (player.age >= 37) return fail('O jogador planeja se aposentar e não pretende renovar');
    const minimum = ceilMoney(
      Math.min(
        player.salary.cents * 3,
        Math.max(player.salary.cents, player.marketValue.cents / 240),
      ),
      MONEY_STEPS.salary,
    );
    if (!command.salary || command.salary < minimum)
      return fail(
        'Reajuste necessário: salário mínimo mensal de R$ ' +
          (minimum / 100).toLocaleString('pt-BR'),
      );
    if (command.salary > financialLimits(state, club).salary + player.salary.cents)
      return fail('A renovação ultrapassa o limite da folha salarial');
    management.contracts = {
      ...management.contracts,
      [player.id]:
        Math.max(state.lastProcessedAt, contractEnd(state, player)) +
        (command.years ?? 1) * 365 * 86400000,
    };
    return done(
      {
        ...state,
        management,
        players: {
          ...state.players,
          byId: {
            ...state.players.byId,
            [player.id]: { ...player, salary: { ...player.salary, cents: command.salary } },
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
    (o) => o.id === command.offerId && o.sellerId === club.id && o.status === 'pending',
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
  const sold = state.players.byId[offer.playerId],
    buyer = state.clubs.byId[offer.buyerId];
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
  const context = transferContext(state, sold, buyer, offer.fee);
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
  const management = { ...state.management };
  const charges = [...(management.charges ?? [])];
  const clubs = { ...state.clubs.byId };
  const debts = { ...state.debts };
  const wageDebts = { ...management.wageDebts };
  // Calendar boundaries use Brasília's fixed UTC-3, including skipped months.
  const date = new Date(state.lastProcessedAt - 10800000);
  let boundary = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 3);
  while (boundary <= at) {
    const month = new Date(boundary - 10800000).toISOString().slice(0, 7);
    for (const original of Object.values(clubs)) {
      if (charges.some((c) => c.clubId === original.id && c.month === month)) continue;
      const wages = roundMoney(
        original.playerIds.reduce(
          (sum, id) => sum + (state.players.byId[id]?.salary.cents ?? 0),
          0,
        ),
      );
      const maintenance = roundMoney(
        maintenanceBreakdown(state, original).reduce((sum, item) => sum + item.cost, 0),
      );
      const oldDebt = debts[original.id] ?? 0;
      const owed = oldDebt + wages + maintenance;
      const paid = Math.min(original.balance.cents, owed);
      debts[original.id] = roundMoney(owed - paid);
      // Settle old salary arrears first, then this month's salaries, then maintenance.
      wageDebts[original.id] = roundMoney(
        Math.max(0, (wageDebts[original.id] ?? 0) + wages - paid),
      );
      clubs[original.id] = {
        ...original,
        balance: { ...original.balance, cents: roundMoney(original.balance.cents - paid) },
      };
      charges.push({ clubId: original.id, month, wages, maintenance, unpaid: debts[original.id]! });
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
  const offers = [...(state.management?.offers ?? [])];
  for (const member of state.participants) {
    const seller = state.clubs.byId[member.clubId];
    if (!seller) continue;
    for (const id of seller.playerIds) {
      const player = state.players.byId[id];
      if (!player || !state.management?.policies?.[id]?.available) continue;
      if (offers.some((o) => o.playerId === id && o.status === 'pending')) continue;
      const candidates = Object.values(state.clubs.byId).filter(
        (b) => b.id !== seller.id && !state.participants.some((p) => p.clubId === b.id),
      );
      for (const buyer of candidates.sort((a, b) => b.balance.cents - a.balance.cents)) {
        const positionPlayers = buyer.playerIds.flatMap((pid) => {
          const p = state.players.byId[pid];
          return p?.position === player.position ? [p] : [];
        });
        if (positionPlayers.length >= 2 && positionPlayers.some((p) => p.overall >= player.overall))
          continue;
        const context = transferContext(state, player, buyer);
        if (context.blocked) continue;
        const fee = context.minimumFee,
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
        });
        break;
      }
    }
  }
  return { ...state, management: { ...state.management, offers } };
}
