import { z } from 'zod';
import {
  countSchema,
  entityIdSchema,
  nameSchema,
  uniqueIdsSchema,
  userIdSchema,
} from './primitives.js';

export const leagueModeSchema = z.enum(['offline', 'multiplayer']);
export const leagueParticipantSchema = z
  .strictObject({
    userId: userIdSchema,
    clubId: entityIdSchema,
  })
  .readonly();

export const leagueSchema = z
  .strictObject({
    id: entityIdSchema,
    name: nameSchema,
    mode: leagueModeSchema,
    administratorId: userIdSchema,
    season: countSchema.refine((season) => season > 0, 'Temporada inválida'),
    clubIds: uniqueIdsSchema,
    participants: z.array(leagueParticipantSchema).readonly(),
  })
  .superRefine((league, context) => {
    const users = new Set<string>();
    const clubs = new Set<string>();
    for (const [index, participant] of league.participants.entries()) {
      if (users.has(participant.userId)) {
        context.addIssue({
          code: 'custom',
          path: ['participants', index, 'userId'],
          message: 'Usuário já participa desta liga',
        });
      }
      if (clubs.has(participant.clubId) || !league.clubIds.includes(participant.clubId)) {
        context.addIssue({
          code: 'custom',
          path: ['participants', index, 'clubId'],
          message: 'Clube indisponível nesta liga',
        });
      }
      users.add(participant.userId);
      clubs.add(participant.clubId);
    }
    if (!users.has(league.administratorId)) {
      context.addIssue({
        code: 'custom',
        path: ['administratorId'],
        message: 'Administrador deve participar da liga',
      });
    }
    if (league.mode === 'offline' && league.participants.length !== 1) {
      context.addIssue({
        code: 'custom',
        path: ['participants'],
        message: 'Liga offline deve ter um participante',
      });
    }
  })
  .readonly();
