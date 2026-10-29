import { roundMoney } from '../config/money-precision.js';
import { z } from 'zod';
import { lineupSchema, lineupPresetSchema } from './tactics.js';
import { clubSchema } from './club.js';
import { playerSchema } from './player.js';
import { stadiumSchema } from './stadium.js';
import { trainingCenterSchema } from './training-center.js';
import { normalizedSchema } from './normalized.js';
import {
  gameAmountSchema,
  salaryAmountSchema,
  ticketAmountSchema,
  countSchema,
  entityIdSchema,
  nameSchema,
  userIdSchema,
} from './primitives.js';
import { leagueModeSchema } from './league.js';

export const MATCH_DURATION_MS = 90_000;

export const fixtureSchema = z.strictObject({
  neutral: z.boolean().optional(),
  stadiumId: entityIdSchema.optional(),
  group: z.string().min(1).max(8).optional(),
  awayGroup: z.string().min(1).max(8).optional(),
  id: z.string(),
  competitionId: z.string(),
  round: countSchema,
  homeId: entityIdSchema,
  awayId: entityIdSchema,
  scheduledAt: countSchema,
});
export const matchActionSchema = z.strictObject({
  minute: z.number().min(0).max(90),
  type: z.enum([
    'kickoff',
    'pass',
    'tackle',
    'shot',
    'goal',
    'corner',
    'foul',
    'yellow',
    'red',
    'dribble',
    'save',
    'goal-kick',
    'interception',
    'free-kick',
    'cross',
    'penalty',
  ]),
  side: z.enum(['home', 'away']),
  playerId: entityIdSchema.optional(),
  assistId: entityIdSchema.optional(),
  targetId: entityIdSchema.optional(),
  x: z.number().min(-32).max(32),
  z: z.number().min(-50).max(50),
  endX: z.number().min(-35).max(35).optional(),
  endZ: z.number().min(-55).max(55).optional(),
  coordinates: z.array(z.number().int().min(-500).max(500)).max(44).optional(),
  positions: z
    .record(
      entityIdSchema,
      z.object({ x: z.number().min(-32).max(32), z: z.number().min(-50).max(50) }),
    )
    .optional(),
  outcome: z.enum(['goal', 'saved', 'wide', 'blocked', 'complete', 'intercepted']).optional(),
  interceptorId: entityIdSchema.optional(),
  keeperId: entityIdSchema.optional(),
  keeperDive: z.enum(['left', 'right', 'center']).optional(),
  wallIds: z.array(entityIdSchema).max(5).optional(),
  setPiece: z.enum(['free-kick', 'corner', 'penalty']).optional(),
  header: z.boolean().optional(),
  startHeight: z.number().min(0).max(5).optional(),
  endHeight: z.number().min(0).max(5).optional(),
  arc: z.number().min(0).max(12).optional(),
  onTarget: z.boolean().optional(),
  xg: z.number().min(0).max(1).optional(),
});
export const matchResultSchema = z.strictObject({
  status: z.string().default('finished'),
  fixtureId: z.string(),
  homeGoals: countSchema,
  awayGoals: countSchema,
  penalties: z.object({ home: countSchema, away: countSchema }).optional(),
  attendance: countSchema,
  ticketPriceCents: ticketAmountSchema.optional(),
  revenue: gameAmountSchema,
  seed: z.number().int(),
  startedAt: countSchema.optional(),
  durationMs: z
    .union([z.literal(45000), z.literal(225000), z.literal(MATCH_DURATION_MS)])
    .optional(),
  lineups: z.object({ home: z.array(entityIdSchema), away: z.array(entityIdSchema) }).optional(),
  homeId: entityIdSchema.optional(),
  awayId: entityIdSchema.optional(),
  stadiumId: entityIdSchema.optional(),
  actions: z.array(matchActionSchema).optional(),
  statistics: z
    .object({
      home: z.object({
        possession: z.number(),
        shots: countSchema,
        shotsOnTarget: countSchema,
        xg: z.number(),
        passes: countSchema,
        corners: countSchema,
        fouls: countSchema,
      }),
      away: z.object({
        possession: z.number(),
        shots: countSchema,
        shotsOnTarget: countSchema,
        xg: z.number(),
        passes: countSchema,
        corners: countSchema,
        fouls: countSchema,
      }),
    })
    .optional(),
  tacticalPlans: z
    .object({
      home: lineupSchema.extend({ starters: z.array(entityIdSchema).max(11) }),
      away: lineupSchema.extend({ starters: z.array(entityIdSchema).max(11) }),
    })
    .optional(),
  ratings: z.record(entityIdSchema, z.number().min(0).max(10)).optional(),
  scorers: z.array(
    z.strictObject({
      playerId: entityIdSchema,
      assistId: entityIdSchema.optional(),
      minute: countSchema,
      side: z.enum(['home', 'away']),
    }),
  ),
});
export const participantSchema = z.strictObject({
  userId: userIdSchema,
  clubId: entityIdSchema,
  ready: z.boolean(),
  lastSeenAt: countSchema.optional(),
  online: z.boolean().optional(),
});
export const negotiationSchema = z.strictObject({
  expiresAt: z.number().optional(),
  blockedUntil: z.number().optional(),
  lowAttempts: z.number().optional(),
  closeAttempts: z.number().optional(),
  revealed: z.boolean().optional(),
  salaryFirm: z.boolean().optional(),
  minimumSalary: z.number().optional(),
  reply: z.string().optional(),
  sellerId: entityIdSchema.optional(),
  id: entityIdSchema,
  buyerId: entityIdSchema,
  playerId: entityIdSchema,
  fee: gameAmountSchema,
  offeredSalary: salaryAmountSchema.nullable(),
  interest: z.number().min(0).max(100),
  status: z.enum(['salary', 'completed', 'rejected']),
});
export const cupNodeSchema = z.strictObject({
  neutral: z.boolean().optional(),
  stadiumId: entityIdSchema.optional(),
  legs: z.union([z.literal(1), z.literal(2)]).optional(),
  label: z.string().max(80).optional(),
  id: z.string(),
  competitionId: z.string(),
  round: countSchema,
  homeId: entityIdSchema.nullable(),
  awayId: entityIdSchema.nullable(),
  leftId: z.string().nullable(),
  rightId: z.string().nullable(),
  winnerId: entityIdSchema.nullable(),
  scheduledAt: countSchema,
});
export const worldStateSchema = z.strictObject({
  id: entityIdSchema,
  name: nameSchema,
  deletedAt: countSchema.optional(),
  mode: leagueModeSchema,
  administratorId: userIdSchema,
  seed: z.number().int(),
  season: countSchema,
  ticketPrices: z.record(z.string(), ticketAmountSchema).optional(),
  homeTicketPrices: z.record(entityIdSchema, ticketAmountSchema).optional(),
  seasonArchives: z
    .array(
      z.strictObject({
        season: countSchema,
        clubs: normalizedSchema(clubSchema),
        fixtures: z.array(fixtureSchema),
        results: z.array(matchResultSchema),
        cups: z.array(cupNodeSchema),
        competitionNotes: z.record(z.string(), z.string()).optional(),
      }),
    )
    .optional(),
  round: countSchema,
  revision: countSchema,
  status: z.enum(['active', 'finished']),
  clubs: normalizedSchema(clubSchema),
  players: normalizedSchema(playerSchema),
  stadiums: normalizedSchema(stadiumSchema),
  centers: normalizedSchema(trainingCenterSchema),
  participants: z.array(participantSchema),
  returningClubs: z.record(userIdSchema, entityIdSchema).optional(),
  inviteCode: z.string().optional(),
  admission: z
    .object({
      division: z.enum(['A', 'B', 'C', 'D', 'REGIONAL']).nullable(),
      assignment: z.enum(['chosen', 'random']),
    })
    .default({ division: null, assignment: 'chosen' }),
  requests: z
    .array(
      z.object({
        userId: userIdSchema,
        clubId: entityIdSchema.optional(),
        requestedAt: countSchema,
      }),
    )
    .default([]),
  trophies: z
    .array(
      z.object({
        clubId: entityIdSchema,
        competitionId: z.string(),
        season: countSchema,
        wonAt: countSchema,
      }),
    )
    .default([]),
  ratingHistory: z
    .array(
      z.object({
        fixtureId: z.string(),
        season: countSchema,
        playerId: entityIdSchema,
        rating: z.number().min(0).max(10),
      }),
    )
    .default([]),
  fixtures: z.array(fixtureSchema),
  results: z.array(matchResultSchema),
  cups: z.array(cupNodeSchema),
  negotiations: z.array(negotiationSchema),
  tactics: z.record(entityIdSchema, lineupSchema).default({}),
  lineupPresets: z.record(entityIdSchema, z.array(lineupPresetSchema).max(3)).default({}),
  chemistry: z.record(entityIdSchema, z.record(entityIdSchema, countSchema)).default({}),
  workload: z
    .record(
      entityIdSchema,
      z.strictObject({ lastPlayedAt: countSchema, consecutiveMatches: countSchema }),
    )
    .default({}),
  injuries: z.record(entityIdSchema, countSchema),
  development: z.record(entityIdSchema, z.number().nonnegative()),
  debts: z.record(entityIdSchema, gameAmountSchema),
  lastProcessedAt: countSchema,
  nextScheduledAt: countSchema,
  seasonClock: z.literal(1).optional(),
  calendarAnchor: z.object({ realAt: countSchema, gameAt: countSchema }).optional(),
  createdAt: countSchema,
  competitionNotes: z.record(z.string(), z.string()).optional(),
  roundDates: z.record(z.string(), z.number()).optional(),
  roundCalendarVersion: z.number().optional(),
  competitionDraws: z
    .array(
      z.object({
        id: z.string(),
        competitionId: z.string(),
        scheduledAt: z.number(),
        participantIds: z.array(z.string()),
        completedAt: z.number().optional(),
        kind: z.enum(['groups', 'knockout']),
        seed: z.number(),
      }),
    )
    .optional(),
  competitionRulesVersion: z.number().int().nonnegative().optional(),
  management: z
    .object({
      policies: z
        .record(
          entityIdSchema,
          z.object({
            available: z.boolean(),
            rivals: z.boolean(),
            interest: z.number().int().min(1).max(100),
          }),
        )
        .optional(),
      contracts: z.record(entityIdSchema, z.number().int().nonnegative()).optional(),
      offers: z
        .array(
          z.object({
            id: z.string(),
            playerId: entityIdSchema,
            buyerId: entityIdSchema,
            sellerId: entityIdSchema,
            fee: gameAmountSchema,
            salary: salaryAmountSchema,
            status: z.enum(['pending', 'accepted', 'rejected']),
          }),
        )
        .optional(),
      charges: z
        .array(
          z.object({
            clubId: entityIdSchema,
            month: z.string(),
            wages: gameAmountSchema,
            maintenance: gameAmountSchema,
            unpaid: gameAmountSchema,
          }),
        )
        .optional(),
      financialPlans: z
        .record(
          entityIdSchema,
          z.object({ transfer: gameAmountSchema, salaries: salaryAmountSchema }),
        )
        .optional(),
      financialHistory: z
        .array(
          z.object({
            clubId: entityIdSchema,
            month: z.string().regex(/^\d{4}-\d{2}$/),
            income: gameAmountSchema,
            expenses: gameAmountSchema,
            fixedCosts: gameAmountSchema,
            season: countSchema.optional(),
          }),
        )
        .optional(),
      historyStartedAtRevision: countSchema.optional(),
      wageDebts: z.record(entityIdSchema, gameAmountSchema).optional(),
    })
    .optional(),
  dataSource: z.string().max(200).optional(),
  dataLicense: z.string().max(500).optional(),
});
export const gameEventSchema = z.strictObject({
  id: entityIdSchema,
  sequence: countSchema,
  occurredAt: countSchema,
  gameOccurredAt: countSchema.optional(),
  actorId: userIdSchema,
  type: z.enum([
    'lineup.changed',
    'league.updated',
    'club.customized',
    'league.joined',
    'ready.changed',
    'round.played',
    'facility.upgraded',
    'transfer.offered',
    'transfer.completed',
    'season.started',
    'tickets.updated',
  ]),
  message: z.string().max(500),
  amount: z
    .number()
    .int()
    .transform((value) => roundMoney(value)),
  balances: z
    .record(
      entityIdSchema,
      z
        .number()
        .int()
        .transform((value) => roundMoney(value)),
    )
    .optional(),
  patch: worldStateSchema.partial().extend({
    admission: worldStateSchema.shape.admission.removeDefault().optional(),
    requests: worldStateSchema.shape.requests.removeDefault().optional(),
    trophies: worldStateSchema.shape.trophies.removeDefault().optional(),
    ratingHistory: worldStateSchema.shape.ratingHistory.removeDefault().optional(),
    tactics: worldStateSchema.shape.tactics.removeDefault().optional(),
    lineupPresets: worldStateSchema.shape.lineupPresets.removeDefault().optional(),
    chemistry: worldStateSchema.shape.chemistry.removeDefault().optional(),
    workload: worldStateSchema.shape.workload.removeDefault().optional(),
  }),
});
export const ledgerEntrySchema = gameEventSchema.omit({ patch: true });
export const standingSchema = z.strictObject({
  id: entityIdSchema,
  played: countSchema,
  points: countSchema,
  wins: countSchema,
  draws: countSchema,
  losses: countSchema,
  goalsFor: countSchema,
  goalsAgainst: countSchema,
  goalDifference: z.number().int(),
});
export const gameSnapshotSchema = z.strictObject({
  serverTime: countSchema.optional(),
  state: worldStateSchema,
  ledger: z.array(ledgerEntrySchema),
  roomId: z.string(),
  tables: z.record(z.string(), z.array(standingSchema)),
});
export const gameSnapshotUpdateSchema = gameSnapshotSchema.omit({ state: true }).extend({
  leagueId: entityIdSchema,
  baseRevision: countSchema,
  revision: countSchema,
  patch: gameEventSchema.shape.patch,
});
export const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('customize'),
    stadiumColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    centerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    pattern: z.enum(['solid', 'stripes', 'hoops', 'sash']),
  }),
  z.strictObject({
    type: z.literal('admission'),
    division: z.enum(['A', 'B', 'C', 'D', 'REGIONAL']).nullable(),
    assignment: z.enum(['chosen', 'random']),
  }),
  z.strictObject({
    type: z.literal('financial-plan'),
    transfer: gameAmountSchema,
    salaries: salaryAmountSchema,
  }),
  z.strictObject({ type: z.literal('ready'), ready: z.boolean() }),
  z.strictObject({ type: z.literal('advance') }),
  z.strictObject({
    type: z.literal('home-ticket-price'),
    priceCents: z
      .number()
      .int()
      .min(2500)
      .max(50000)
      .transform((value) => Math.round(value / 2500) * 2500),
  }),
  z.strictObject({
    type: z.literal('ticket-price'),
    fixtureId: z.string().min(1),
    priceCents: z
      .number()
      .int()
      .min(2500)
      .max(50000)
      .transform((value) => Math.round(value / 2500) * 2500),
  }),
  lineupSchema.extend({ type: z.literal('lineup') }),
  z.strictObject({
    type: z.literal('lineup-preset'),
    action: z.enum(['create', 'rename', 'update', 'delete']),
    id: entityIdSchema,
    name: z.string().trim().min(1).max(40).optional(),
    lineup: lineupSchema.optional(),
  }),
  z.strictObject({
    type: z.literal('upgrade'),
    target: z.enum([
      'pitch',
      'surroundings',
      'structure',
      'food',
      'shirts',
      'hospitality',
      'fitness',
      'medical',
      'scouting',
      'coaching',
      'marketing',
    ]),
  }),
  z.strictObject({ type: z.literal('offer'), playerId: entityIdSchema, fee: gameAmountSchema }),
  z.strictObject({
    type: z.literal('sign-free'),
    playerId: entityIdSchema,
    salary: salaryAmountSchema,
  }),
  z.strictObject({
    type: z.literal('salary'),
    negotiationId: entityIdSchema,
    salary: salaryAmountSchema,
  }),
  z.strictObject({
    type: z.literal('management'),
    action: z.enum([
      'policy',
      'renew',
      'accept',
      'reject',
      'sell-facility',
      'pay-debt',
      'center',
      'promote-academy',
      'scout-academy',
      'dismiss-academy',
    ]),
    playerId: entityIdSchema.optional(),
    offerId: z.string().optional(),
    target: z.string().optional(),
    available: z.boolean().optional(),
    rivals: z.boolean().optional(),
    interest: z.number().int().min(1).max(100).optional(),
    salary: salaryAmountSchema.optional(),
    years: z.number().int().min(1).max(5).optional(),
  }),
  z.strictObject({ type: z.literal('new-season') }),
]);
export const connectOptionsSchema = z.strictObject({
  token: z.string().optional(),
  appCheckToken: z.string().optional(),
  guestId: z.string().optional(),
  leagueId: entityIdSchema.optional(),
  name: nameSchema.default('Liga dos amigos'),
  mode: leagueModeSchema.default('offline'),
  clubId: entityIdSchema.optional(),
  assignment: z.enum(['chosen', 'random']).default('chosen'),
});
export type WorldState = z.infer<typeof worldStateSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;
export type GameCommand = z.infer<typeof commandSchema>;
export type Fixture = z.infer<typeof fixtureSchema>;
export type MatchResult = z.infer<typeof matchResultSchema>;
export type CupNode = z.infer<typeof cupNodeSchema>;
export type Negotiation = z.infer<typeof negotiationSchema>;
