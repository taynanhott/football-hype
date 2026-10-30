import { maxContractYears, moraleSensitivity } from './player-contracts.js';
import { seasonStart } from '../competitions/season-calendar.js';
import { scheduleRegionalQualifiers } from '../competitions/regional-qualifiers.js';
import { prepareAcademy } from './academy.js';
import { financialLimits, consumeTransferBudget } from '../finance/financial-management.js';
import { manageClub, transferContext, upgradePrice } from './management.js';
import { continentalPlaces, cupFinal } from '../competitions/qualification.js';
import { scheduledFixtures } from '../competitions/fixtures.js';
import {
  COMPETITIONS,
  MAX_SQUAD_SIZE,
  roundMoney,
  MONEY_STEPS,
  MATCH_DURATION_MS,
  type ClubSnapshot,
  GAMEPLAY,
  type GameCommand,
  type GameEvent,
  type Negotiation,
  type WorldState,
} from '@football/shared';
import { domainError } from '../core/domain-error.js';
import { failure, success, type Result } from '../core/result.js';
import { BRAZIL_LEAGUE_STRENGTH } from '../market/interest.js';
import { nextPlayingTime, isPlayingWindow } from '../competitions/calendar.js';
import { nextRealMatchTime } from './season-clock.js';
import { playNextBatch } from './play-batch.js';
import { agePlayer } from '../players/development.js';
import { ACCESS_GRAPH, qualificationPlaces, standings } from '../competitions/standings.js';
import { seasonSchedule } from './world-factory.js';
import {
  feeAcceptedState,
  salaryAcceptedState,
  nextReadyState,
  nextSeasonState,
} from '../multiplayer/machines.js';
export type CommandContext = {
  state: WorldState;
  club: ClubSnapshot;
  command: Exclude<GameCommand, { type: 'club-settings' }>;
  userId: string;
  now: number;
  eventId: string;
};
export type CommandOutcome = {
  next: WorldState;
  type: GameEvent['type'];
  message: string;
  amount: number;
};
export function handleCommand(input: CommandContext): Result<CommandOutcome> {
  const action = input.command;
  if (
    (action.type === 'home-ticket-price' || action.type === 'ticket-price') &&
    (!Number.isSafeInteger(action.priceCents) ||
      action.priceCents < MONEY_STEPS.ticket ||
      action.priceCents > 50000)
  )
    return failure(domainError('VALIDATION_ERROR', 'O ingresso deve custar entre R$ 25 e R$ 500'));
  const context: CommandContext = {
    ...input,
    command:
      action.type === 'home-ticket-price' || action.type === 'ticket-price'
        ? { ...action, priceCents: roundMoney(action.priceCents, MONEY_STEPS.ticket) }
        : action.type === 'offer'
          ? { ...action, fee: roundMoney(action.fee) }
          : action.type === 'salary' || action.type === 'sign-free'
            ? { ...action, salary: roundMoney(action.salary, MONEY_STEPS.salary) }
            : action,
  };
  const { command } = context;
  switch (command.type) {
    case 'financial-plan': {
      const { state, club } = context;
      if (command.transfer + command.salaries > Math.max(0, club.balance.cents))
        return failure(
          domainError(
            'VALIDATION_ERROR',
            'A soma dos orçamentos não pode ultrapassar o caixa do clube',
          ),
        );
      return success({
        next: {
          ...state,
          management: {
            ...state.management,
            financialPlans: {
              ...state.management?.financialPlans,
              [club.id]: { transfer: command.transfer, salaries: command.salaries },
            },
          },
        },
        type: 'club.customized',
        message: 'Limites financeiros atualizados',
        amount: 0,
      });
    }
    case 'management':
      return manageClub(context);
    case 'home-ticket-price': {
      const { state, club } = context;
      if (
        !Number.isInteger(command.priceCents) ||
        command.priceCents < MONEY_STEPS.ticket ||
        command.priceCents > 50000
      )
        return failure(
          domainError('VALIDATION_ERROR', 'O ingresso deve custar entre R$ 25 e R$ 500'),
        );
      return success({
        next: {
          ...state,
          homeTicketPrices: { ...state.homeTicketPrices, [club.id]: command.priceCents },
        },
        type: 'tickets.updated',
        message: `${club.name}: ingresso para jogos em casa definido em R$ ${(command.priceCents / 100).toFixed(0)}`,
        amount: 0,
      });
    }
    case 'ticket-price': {
      const { state, club } = context;
      const fixture = scheduledFixtures(state).find((item) => item.id === command.fixtureId);
      if (
        !fixture ||
        fixture.homeId !== club.id ||
        fixture.neutral ||
        (fixture.stadiumId && fixture.stadiumId !== club.stadiumId) ||
        state.results.some((result) => result.fixtureId === fixture.id) ||
        fixture.scheduledAt <= state.lastProcessedAt
      )
        return failure(domainError('VALIDATION_ERROR', 'Escolha um jogo futuro dentro de casa'));
      if (
        !Number.isInteger(command.priceCents) ||
        command.priceCents < MONEY_STEPS.ticket ||
        command.priceCents > 50000
      )
        return failure(
          domainError('VALIDATION_ERROR', 'O ingresso deve custar entre R$ 25 e R$ 500'),
        );
      return success({
        next: {
          ...state,
          ticketPrices: { ...state.ticketPrices, [fixture.id]: command.priceCents },
        },
        type: 'tickets.updated',
        message: `${club.name}: ingresso definido em R$ ${(command.priceCents / 100).toFixed(0)} para o jogo contra ${state.clubs.byId[fixture.awayId]?.name ?? 'adversário'}`,
        amount: 0,
      });
    }
    case 'admission':
      if (context.userId !== context.state.administratorId)
        return failure(
          domainError('VALIDATION_ERROR', 'Somente o administrador pode configurar a entrada'),
        );
      return success({
        next: {
          ...context.state,
          admission: { division: command.division, assignment: command.assignment },
        },
        type: 'league.updated',
        message: 'Regras de entrada atualizadas',
        amount: 0,
      });
    case 'customize': {
      const { state, club } = context;
      const stadium = state.stadiums.byId[club.stadiumId];
      const center = state.centers.byId[club.trainingCenterId];
      if (!stadium || !center)
        return failure(domainError('ENTITY_NOT_FOUND', 'Estrutura indisponível'));
      return success({
        next: {
          ...state,
          clubs: {
            ...state.clubs,
            byId: {
              ...state.clubs.byId,
              [club.id]: {
                ...club,
                kit: {
                  primary: command.primary,
                  secondary: command.secondary,
                  pattern: command.pattern,
                },
              },
            },
          },
          stadiums: {
            ...state.stadiums,
            byId: {
              ...state.stadiums.byId,
              [stadium.id]: { ...stadium, color: command.stadiumColor },
            },
          },
          centers: {
            ...state.centers,
            byId: { ...state.centers.byId, [center.id]: { ...center, color: command.centerColor } },
          },
        },
        type: 'club.customized',
        message: 'Cores e uniforme atualizados',
        amount: 0,
      });
    }
    case 'lineup-preset': {
      const presets = context.state.lineupPresets?.[context.club.id] ?? [];
      const existing = presets.find((preset) => preset.id === command.id);
      if (command.action === 'create' ? presets.length >= 3 || existing : !existing)
        return failure(
          domainError(
            'VALIDATION_ERROR',
            'Você pode salvar até três presets. Escolha um preset existente para editar.',
          ),
        );
      if ((command.action === 'create' || command.action === 'rename') && !command.name)
        return failure(domainError('VALIDATION_ERROR', 'Informe um nome para o preset'));
      if (command.action === 'create' || command.action === 'update') {
        const plan = command.lineup;
        if (
          !plan ||
          [...plan.starters, ...(plan.bench ?? [])].some(
            (id) => context.state.players.byId[id]?.clubId !== context.club.id,
          ) ||
          (plan.bench ?? []).some((id) => plan.starters.includes(id))
        )
          return failure(
            domainError(
              'VALIDATION_ERROR',
              'O preset precisa conter jogadores do seu clube, sem repetir titulares no banco',
            ),
          );
      }
      const nextPresets =
        command.action === 'create'
          ? [...presets, { id: command.id, name: command.name!, lineup: command.lineup! }]
          : command.action === 'delete'
            ? presets.filter((preset) => preset.id !== command.id)
            : presets.map((preset) =>
                preset.id !== command.id
                  ? preset
                  : {
                      ...preset,
                      ...(command.action === 'rename'
                        ? { name: command.name! }
                        : { lineup: command.lineup! }),
                    },
              );
      return success({
        next: {
          ...context.state,
          lineupPresets: { ...context.state.lineupPresets, [context.club.id]: nextPresets },
        },
        type: 'lineup.changed',
        message: 'Preset de escalação atualizado',
        amount: 0,
      });
    }
    case 'lineup': {
      if (
        command.starters.length !== 11 ||
        new Set(command.starters).size !== 11 ||
        command.starters.some((id) => statePlayerInvalid(context.state, context.club, id)) ||
        (command.bench ?? []).some(
          (id) =>
            command.starters.includes(id) || statePlayerInvalid(context.state, context.club, id),
        )
      )
        return failure(
          domainError(
            'VALIDATION_ERROR',
            'Escolha onze titulares e reservas disponíveis do seu clube, sem repetir atletas',
          ),
        );
      return success({
        next: {
          ...context.state,
          tactics: {
            ...context.state.tactics,
            [context.club.id]: {
              formation: command.formation,
              starters: command.starters,
              bench: command.bench ?? [],
              ...(command.style ? { style: command.style } : {}),
            },
          },
        },
        type: 'lineup.changed',
        message: 'Escalação e formação atualizadas',
        amount: 0,
      });
    }
    case 'ready':
      return handleReady({ ...context, command });
    case 'advance':
      return handleAdvance({ ...context, command });
    case 'upgrade':
      return handleUpgrade({ ...context, command });
    case 'sign-free': {
      if (context.state.players.byId[command.playerId]?.clubId !== null)
        return failure(domainError('VALIDATION_ERROR', 'Este jogador não está livre no mercado'));
      const existing = context.state.negotiations.find(
        (n) =>
          n.playerId === command.playerId &&
          n.buyerId === context.club.id &&
          n.status === 'salary' &&
          (n.expiresAt ?? Infinity) > context.state.lastProcessedAt,
      );
      if (existing)
        return handleSalary({
          ...context,
          command: { type: 'salary', negotiationId: existing.id, salary: command.salary },
        });
      const offered = handleOffer({
        ...context,
        command: { type: 'offer', playerId: command.playerId, fee: 0 },
      });
      if (!offered.ok) return offered;
      return handleSalary({
        ...context,
        state: offered.value.next,
        command: { type: 'salary', negotiationId: context.eventId, salary: command.salary },
      });
    }
    case 'offer':
      return handleOffer({ ...context, command });
    case 'salary':
      return handleSalary({ ...context, command });
    case 'new-season':
      return handleNewSeason({ ...context, command });
  }
}
function handleReady({
  state,
  club,
  command,
  userId,
}: Omit<CommandContext, 'command'> & {
  command: Extract<GameCommand, { type: 'ready' }>;
}): Result<CommandOutcome> {
  let next: WorldState = state;
  const type: GameEvent['type'] = 'ready.changed';
  let message = '';
  const amount = 0;
  next = {
    ...state,
    participants: state.participants.map((member) =>
      member.userId === userId
        ? { ...member, ready: nextReadyState(member.ready, command.ready) }
        : member,
    ),
  };
  message = command.ready ? `${club.name} está pronto` : `${club.name} voltou a preparar o time`;
  return success({ next, type, message, amount });
}

function handleAdvance({
  state,
  userId,
  now,
}: Omit<CommandContext, 'command'> & {
  command: Extract<GameCommand, { type: 'advance' }>;
}): Result<CommandOutcome> {
  let next: WorldState = state;
  let type: GameEvent['type'] = 'ready.changed';
  let message = '';
  const amount = 0;
  if (state.status !== 'active')
    return failure(domainError('VALIDATION_ERROR', 'Temporada encerrada'));
  const majority =
    state.participants.filter((member) => member.ready).length > state.participants.length / 2;
  if (userId !== state.administratorId && !majority)
    return failure(domainError('VALIDATION_ERROR', 'Aguarde a maioria ou o administrador'));
  if (!state.seasonClock && userId !== state.administratorId && !isPlayingWindow(now)) {
    next = { ...state, nextScheduledAt: nextPlayingTime(now) };
    message = 'Rodada antecipada para a próxima janela, às 08h de Brasília';
  } else {
    const played = playNextBatch(state, now);
    if (!played.ok) return played;
    next = played.value;
    type = 'round.played';
    message = `Rodada global ${next.round} concluída`;
  }
  return success({ next, type, message, amount });
}

function handleUpgrade({
  state,
  club,
  command,
}: Omit<CommandContext, 'command'> & {
  command: Extract<GameCommand, { type: 'upgrade' }>;
}): Result<CommandOutcome> {
  let next: WorldState = state;
  let type: GameEvent['type'] = 'ready.changed';
  let message = '';
  let amount = 0;
  const result = upgrade(state, club.id, command.target);
  if (!result.ok) return result;
  next = result.value.state;
  amount = -result.value.cost;
  type = 'facility.upgraded';
  message = `${club.name}: melhoria em ${command.target}`;
  return success({ next, type, message, amount });
}

function handleOffer({
  state,
  club,
  command,
  eventId,
}: Omit<CommandContext, 'command'> & {
  command: Extract<GameCommand, { type: 'offer' }>;
}): Result<CommandOutcome> {
  let next: WorldState = state;
  let type: GameEvent['type'] = 'ready.changed';
  let message = '';
  const amount = 0;
  if (club.playerIds.length >= MAX_SQUAD_SIZE)
    return failure(domainError('VALIDATION_ERROR', 'O elenco atingiu o limite de 45 jogadores'));
  const player = state.players.byId[command.playerId];
  if (player?.academyClubId && !player.clubId)
    return failure(
      domainError('VALIDATION_ERROR', 'Atleta disponível apenas para promoção pela base'),
    );
  const center = state.centers.byId[club.trainingCenterId];
  if (
    !player ||
    !center ||
    player.clubId === club.id ||
    state.negotiations.some(
      (offer) =>
        offer.playerId === player.id &&
        offer.status === 'salary' &&
        (offer.expiresAt ?? Infinity) > state.lastProcessedAt,
    )
  )
    return failure(domainError('VALIDATION_ERROR', 'Jogador indisponível para negociação'));
  const context = transferContext(state, player, club);
  const interest = context.playerInterest;
  const minimum = context.minimumFee;
  const previous = [...state.negotiations]
    .reverse()
    .find((n) => n.playerId === player.id && n.buyerId === club.id);
  const clock = state.lastProcessedAt;
  if (previous?.status === 'review' && command.fee <= previous.fee)
    return failure(
      domainError('VALIDATION_ERROR', 'Para atualizar a proposta, ofereça um valor maior.'),
    );
  if ((previous?.blockedUntil ?? 0) > clock)
    return failure(
      domainError('VALIDATION_ERROR', 'Conversas suspensas por uma semana no calendário do jogo.'),
    );
  if (context.blocked)
    return failure(domainError('VALIDATION_ERROR', 'O clube não tem interesse em negociar'));
  if (command.fee > financialLimits(state, club).transfer)
    return failure(
      domainError(
        'INSUFFICIENT_FUNDS',
        'A proposta excede o limite disponível para transferências',
      ),
    );
  if (command.fee > club.balance.cents)
    return failure(domainError('INSUFFICIENT_FUNDS', 'Caixa insuficiente para a transferência'));
  if (interest < 1)
    return failure(
      domainError('VALIDATION_ERROR', `Interesse de ${interest}%: jogador recusou o projeto`),
    );
  const reset = Boolean(previous?.blockedUntil && previous.blockedUntil <= clock);
  const low = command.fee < minimum * 0.6;
  const lowAttempts = (reset ? 0 : (previous?.lowAttempts ?? 0)) + (low ? 1 : 0);
  const closeAttempts =
    (reset ? 0 : (previous?.closeAttempts ?? 0)) +
    (!low && command.fee < minimum && previous?.revealed ? 1 : 0);
  const roll = Array.from(eventId).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17) % 100;
  const accepted =
    command.fee >= minimum ||
    (!low &&
      previous?.revealed &&
      closeAttempts <= 3 &&
      roll < Math.max(0, (command.fee / minimum - 0.6) * 150));
  const blockedUntil =
    !accepted && (lowAttempts >= 3 || closeAttempts >= 3) ? clock + 7 * 86400000 : undefined;
  if (!accepted) {
    const reply = low
      ? [
          'Isso é uma proposta ou uma piada? Com esse valor você não leva nem as chuteiras dele.',
          'Você esqueceu uns zeros nessa oferta? Vamos conversar sério.',
          'Essa é a última vez que eu escuto uma proposta tão baixa.',
        ][Math.min(2, Math.max(0, lowAttempts - 1))]!
      : `A oferta está abaixo do que queremos. Nosso valor é R$ ${(minimum / 100).toLocaleString('pt-BR')}.`;
    const rejected: Negotiation = {
      id: eventId,
      buyerId: club.id,
      playerId: player.id,
      ...(player.clubId ? { sellerId: player.clubId } : {}),
      fee: command.fee,
      offeredSalary: null,
      interest,
      status: 'rejected',
      lowAttempts,
      closeAttempts,
      revealed: !low || Boolean(previous?.revealed),
      ...(blockedUntil ? { blockedUntil } : {}),
      reply: reply + (blockedUntil ? ' Conversas suspensas por uma semana.' : ''),
    };
    return success({
      next: { ...state, negotiations: [...state.negotiations, rejected] },
      type: 'transfer.offered',
      message: rejected.reply!,
      amount: 0,
    });
  }
  const negotiation: Negotiation = {
    ...(player.clubId ? { sellerId: player.clubId } : {}),
    id: eventId,
    buyerId: club.id,
    playerId: player.id,
    fee: command.fee,
    offeredSalary: null,
    interest,
    status: player.clubId ? 'review' : feeAcceptedState(),
    ...(player.clubId
      ? {
          reviewAt:
            state.negotiations.find((n) => n.playerId === player.id && n.status === 'review')
              ?.reviewAt ?? clock + 7 * 86400000,
        }
      : {}),
    expiresAt: clock + (player.clubId ? 10 : 3) * 86400000,
    minimumSalary: context.minimumSalary,
    reply: player.clubId
      ? 'Proposta em análise por uma semana do calendário do jogo. A melhor oferta libera a negociação salarial.'
      : 'Vamos conversar com o jogador.',
  };
  next = {
    ...state,
    negotiations: [
      ...state.negotiations.map((n) =>
        n.playerId === player.id && n.buyerId === club.id && n.status === 'review'
          ? { ...n, status: 'rejected' as const, reply: 'Substituída por uma oferta maior.' }
          : n,
      ),
      negotiation,
    ],
  };
  type = 'transfer.offered';
  message = negotiation.reply!;
  return success({ next, type, message, amount });
}

function handleSalary({
  state,
  club,
  command,
}: Omit<CommandContext, 'command'> & {
  command: Extract<GameCommand, { type: 'salary' }>;
}): Result<CommandOutcome> {
  let next: WorldState = state;
  let type: GameEvent['type'] = 'ready.changed';
  let message = '';
  let amount = 0;
  if (club.playerIds.length >= MAX_SQUAD_SIZE)
    return failure(domainError('VALIDATION_ERROR', 'O elenco atingiu o limite de 45 jogadores'));
  const negotiation = state.negotiations.find(
    (offer) =>
      offer.id === command.negotiationId && offer.buyerId === club.id && offer.status === 'salary',
  );
  const player = negotiation ? state.players.byId[negotiation.playerId] : undefined;
  if (!negotiation || !player)
    return failure(domainError('VALIDATION_ERROR', 'Negocie primeiro o valor de transferência'));
  if ((negotiation.expiresAt ?? Infinity) <= state.lastProcessedAt)
    return failure(
      domainError('VALIDATION_ERROR', 'O acordo expirou. Faça uma nova proposta ao clube.'),
    );
  const minimumSalary = Math.min(
    player.salary.cents * 3,
    negotiation.minimumSalary ?? transferContext(state, player, club).minimumSalary,
  );
  const roll =
    Array.from(negotiation.id + command.salary).reduce(
      (n, c) => (n * 31 + c.charCodeAt(0)) >>> 0,
      13,
    ) % 100;
  if (
    command.salary < minimumSalary &&
    (negotiation.salaryFirm ||
      command.salary < minimumSalary * 0.6 ||
      roll >= (command.salary / minimumSalary - 0.6) * 125)
  ) {
    const reply = `Não aceito esse salário. Quero R$ ${(minimumSalary / 100).toLocaleString('pt-BR')} por mês. Esse é meu valor final.`;
    return success({
      next: {
        ...state,
        negotiations: state.negotiations.map((n) =>
          n.id === negotiation.id ? { ...n, minimumSalary, salaryFirm: true, reply } : n,
        ),
      },
      type: 'transfer.offered',
      message: reply,
      amount: 0,
    });
  }
  const seller = player.clubId ? state.clubs.byId[player.clubId] : undefined;
  const clubs = {
    ...state.clubs.byId,
    [club.id]: {
      ...club,
      balance: {
        ...club.balance,
        cents: Math.max(0, roundMoney(club.balance.cents - negotiation.fee - command.salary)),
      },
      playerIds: [...club.playerIds, player.id],
    },
  };
  if (seller)
    clubs[seller.id] = {
      ...seller,
      balance: { ...seller.balance, cents: seller.balance.cents + negotiation.fee },
      playerIds: seller.playerIds.filter((id) => id !== player.id),
    };
  next = {
    ...state,
    debts: {
      ...state.debts,
      [club.id]:
        (state.debts[club.id] ?? 0) +
        Math.max(0, roundMoney(negotiation.fee + command.salary - club.balance.cents)),
    },
    management: {
      ...consumeTransferBudget(state, club.id, negotiation.fee),
      contractHistory: {
        ...state.management?.contractHistory,
        [player.id]: {
          overall: player.overall,
          marketValue: player.marketValue.cents,
          signedAt: state.lastProcessedAt,
          dissatisfied: false,
        },
      },
      policies: {
        ...state.management?.policies,
        [player.id]: { available: false, rivals: false, interest: 35 },
      },
      contracts: {
        ...state.management?.contracts,
        [player.id]:
          state.lastProcessedAt + Math.min(3, maxContractYears(player.age)) * 365 * 86400000,
      },
    },
    clubs: { ...state.clubs, byId: clubs },
    players: {
      ...state.players,
      byId: {
        ...state.players.byId,
        [player.id]: {
          ...player,
          clubId: club.id,
          salary: { ...player.salary, cents: command.salary },
          shirtNumber:
            [...Array(99)]
              .map((_, index) => index + 1)
              .find(
                (number) =>
                  !club.playerIds.some((id) => state.players.byId[id]?.shirtNumber === number),
              ) ?? 99,
        },
      },
    },
    negotiations: state.negotiations.map((offer) =>
      offer.id === negotiation.id
        ? { ...offer, status: salaryAcceptedState(), offeredSalary: command.salary }
        : offer,
    ),
  };
  if (player.academyClubId === club.id && !player.clubId) {
    next = {
      ...next,
      players: {
        ...next.players,
        byId: {
          ...next.players.byId,
          [player.id]: { ...next.players.byId[player.id]!, academyPromotedSeason: state.season },
        },
      },
    };
    next = prepareAcademy(next, club.id);
  }
  type = 'transfer.completed';
  amount = roundMoney(-negotiation.fee - command.salary);
  message = `${player.name} assinou com ${club.name}`;
  return success({ next, type, message, amount });
}

function handleNewSeason({
  state,
  userId,
  now,
}: Omit<CommandContext, 'command'> & {
  command: Extract<GameCommand, { type: 'new-season' }>;
}): Result<CommandOutcome> {
  let next: WorldState = state;
  let type: GameEvent['type'] = 'ready.changed';
  let message = '';
  const amount = 0;
  if (userId !== state.administratorId || state.status !== 'finished')
    return failure(domainError('VALIDATION_ERROR', 'A temporada atual ainda não terminou'));
  const finale = state.results.find((result) => result.fixtureId === 'intercontinental:final');
  if (finale?.startedAt !== undefined && now < finale.startedAt + MATCH_DURATION_MS)
    return failure(
      domainError(
        'VALIDATION_ERROR',
        'Aguarde o encerramento da Copa Intercontinental antes de iniciar a nova temporada',
      ),
    );
  const clubs = { ...state.clubs.byId };
  const slots = continentalPlaces(state);
  const libertadores = slots
    .filter((place) => place.competition === 'libertadores')
    .map((place) => place.clubId);
  const sulaChampion = cupFinal(state, 'sul-americana')?.winnerId;
  if (sulaChampion && !libertadores.includes(sulaChampion)) libertadores.push(sulaChampion);
  const sulAmericana = slots
    .filter((place) => place.competition === 'sul-americana')
    .map((place) => place.clubId);
  const preLibertadores = slots
    .filter((place) => place.competition === 'pre-libertadores')
    .map((place) => place.clubId);
  for (const rule of COMPETITIONS.filter((item) => item.format === 'league' && item.division)) {
    const ids = state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === rule.division);
    const table = standings(
      ids,
      state.fixtures.filter((fixture) => fixture.competitionId === rule.id && !fixture.group),
      state.results,
      rule.tieBreakers,
    );
    const places = qualificationPlaces(table, rule);
    for (const id of places.promoted) {
      const current = clubs[id];
      const division = rule.division ? ACCESS_GRAPH[rule.division].promotion : null;
      if (
        current &&
        division &&
        state.clubs.ids.some((clubId) => state.clubs.byId[clubId]?.division === division)
      )
        clubs[id] = { ...current, division, leagueStrength: BRAZIL_LEAGUE_STRENGTH[division] };
    }
    for (const id of places.relegated) {
      const current = clubs[id];
      const division = rule.division ? ACCESS_GRAPH[rule.division].relegation : null;
      if (
        current &&
        division &&
        state.clubs.ids.some((clubId) => state.clubs.byId[clubId]?.division === division)
      )
        clubs[id] = { ...current, division, leagueStrength: BRAZIL_LEAGUE_STRENGTH[division] };
    }
  }
  const generatedSchedule = seasonSchedule(Object.values(clubs), seasonStart(state.season + 1), {
    libertadores,
    sulAmericana,
    preLibertadores,
    serieB: standings(
      state.clubs.ids.filter((id) => state.clubs.byId[id]?.division === 'B'),
      state.fixtures.filter((f) => f.competitionId === 'serie-b'),
      state.results,
    )
      .slice(0, 12)
      .map((row) => row.id),
  });
  const schedule = generatedSchedule;
  next = {
    ...state,
    ...schedule,
    roundDates: {},
    roundCalendarVersion: 0,
    clubs: { ...state.clubs, byId: clubs },
    players: {
      ...state.players,
      byId: Object.fromEntries(
        Object.values(state.players.byId).map((player) => [
          player.id,
          agePlayer(
            {
              ...player,
              morale: Math.round(
                Math.max(
                  0,
                  Math.min(
                    100,
                    player.morale +
                      (player.clubId && clubs[player.clubId] && state.clubs.byId[player.clubId]
                        ? Math.sign(
                            (clubs[player.clubId]!.leagueStrength ?? 0) -
                              (state.clubs.byId[player.clubId]!.leagueStrength ?? 0),
                          ) *
                          10 *
                          moraleSensitivity(player)
                        : 0),
                  ),
                ),
              ),
            },
            state.centers.byId[state.clubs.byId[player.clubId ?? '']?.trainingCenterId ?? '']
              ?.levels.coaching ?? 1,
            Boolean(player.clubId),
          ),
        ]),
      ),
    },
    season: state.season + 1,
    ...(state.seasonClock
      ? {
          nextScheduledAt: nextRealMatchTime(now),
          calendarAnchor: { realAt: now, gameAt: seasonStart(state.season + 1) },
        }
      : {}),
    lastProcessedAt: seasonStart(state.season + 1),
    management: {
      ...state.management,
      financialHistory: state.management?.financialHistory?.map((row) => ({
        ...row,
        season: row.season ?? state.season,
      })),
    },
    ticketPrices: {},
    seasonArchives: [
      ...(state.seasonArchives ?? []),
      {
        season: state.season,
        clubs: state.clubs,
        fixtures: state.fixtures,
        results: state.results.map((result) => ({
          ...result,
          actions: (result.actions ?? [])
            .filter((action) => action.type === 'yellow' || action.type === 'red')
            .map((action) => ({
              minute: action.minute,
              type: action.type,
              side: action.side,
              x: action.x,
              z: action.z,
            })),
        })),
        cups: state.cups,
        ...(state.regionalQualifiers ? { regionalQualifiers: state.regionalQualifiers } : {}),
        ...(state.competitionNotes ? { competitionNotes: state.competitionNotes } : {}),
      },
    ],
    status: nextSeasonState('finished', 'NEW_SEASON'),
    results: [],
    round: 0,
    negotiations: [],
    injuries: {},
    workload: {},
    participants: state.participants.map((member) => ({ ...member, ready: false })),
  };
  next = scheduleRegionalQualifiers(state, next);
  type = 'season.started';
  message = `Temporada ${next.season} iniciada com acessos e descensos`;
  return success({ next, type, message, amount });
}

function upgrade(
  state: WorldState,
  clubId: string,
  target: Extract<GameCommand, { type: 'upgrade' }>['target'],
): Result<{ state: WorldState; cost: number }> {
  const club = state.clubs.byId[clubId];
  const stadium = club ? state.stadiums.byId[club.stadiumId] : undefined;
  const center = club ? state.centers.byId[club.trainingCenterId] : undefined;
  if (!club || !stadium || !center)
    return failure(domainError('ENTITY_NOT_FOUND', 'Estrutura não encontrada'));
  let updatedStadium = stadium;
  let updatedCenter = center;
  let level = 1;
  if (target in center.levels) {
    const sector = target as keyof typeof center.levels;
    level = center.levels[sector];
    updatedCenter = { ...center, levels: { ...center.levels, [sector]: level + 1 } };
  } else if (target === 'structure') {
    level = Math.max(...stadium.sectors.map((sector) => sector.level));
    updatedStadium = {
      ...stadium,
      sectors: stadium.sectors.map((sector) => ({
        ...sector,
        level: level + 1,
        capacity: sector.capacity + GAMEPLAY.upgradeCapacity * (level + 1 - sector.level),
      })),
    };
  } else if (target === 'pitch' || target === 'surroundings') {
    const key = target === 'pitch' ? 'pitchLevel' : 'surroundingsLevel';
    level = stadium[key];
    updatedStadium = { ...stadium, [key]: level + 1 };
  } else {
    const key = `${target}Level` as keyof typeof stadium.commerce;
    level = stadium.commerce[key];
    updatedStadium = { ...stadium, commerce: { ...stadium.commerce, [key]: level + 1 } };
  }
  if (level >= 5)
    return failure(domainError('VALIDATION_ERROR', 'Estrutura já está no nível máximo'));
  const cost = upgradePrice(level, target);
  if (club.balance.cents < cost)
    return failure(domainError('INSUFFICIENT_FUNDS', 'Caixa insuficiente para a melhoria'));
  return {
    ok: true,
    value: {
      cost,
      state: {
        ...state,
        clubs: {
          ...state.clubs,
          byId: {
            ...state.clubs.byId,
            [club.id]: { ...club, balance: { ...club.balance, cents: club.balance.cents - cost } },
          },
        },
        stadiums: {
          ...state.stadiums,
          byId: { ...state.stadiums.byId, [stadium.id]: updatedStadium },
        },
        centers: { ...state.centers, byId: { ...state.centers.byId, [center.id]: updatedCenter } },
      },
    },
  };
}

function statePlayerInvalid(state: WorldState, club: ClubSnapshot, id: string) {
  return (
    state.players.byId[id]?.clubId !== club.id ||
    ((state.injuries[id] ?? 0) > 0 &&
      state.centers.byId[club.trainingCenterId]?.operations?.clearance?.playerId !== id)
  );
}
