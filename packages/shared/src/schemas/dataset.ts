import { z } from 'zod';
import { clubSchema } from './club.js';
import { playerSchema } from './player.js';
import { stadiumSchema } from './stadium.js';
import { trainingCenterSchema } from './training-center.js';
import { normalizedSchema } from './normalized.js';
import { fixtureSchema } from './game.js';

export const worldDatasetSchema = z
  .strictObject({
    clubs: normalizedSchema(clubSchema),
    players: normalizedSchema(playerSchema),
    stadiums: normalizedSchema(stadiumSchema),
    centers: normalizedSchema(trainingCenterSchema),
    fixtures: z.array(fixtureSchema).optional(),
    source: z.string().min(1).max(200),
    license: z.string().min(1).max(500),
  })
  .superRefine((dataset, context) => {
    for (const club of Object.values(dataset.clubs.byId)) {
      if (
        dataset.stadiums.byId[club.stadiumId]?.clubId !== club.id ||
        dataset.centers.byId[club.trainingCenterId]?.clubId !== club.id ||
        club.playerIds.some((id) => dataset.players.byId[id]?.clubId !== club.id)
      )
        context.addIssue({
          code: 'custom',
          path: ['clubs', 'byId', club.id],
          message: 'Referências de clube inconsistentes',
        });
    }
    for (const player of Object.values(dataset.players.byId)) {
      if (player.clubId && !dataset.clubs.byId[player.clubId]?.playerIds.includes(player.id))
        context.addIssue({
          code: 'custom',
          path: ['players', 'byId', player.id],
          message: 'Vínculo de jogador inconsistente',
        });
    }
    for (const fixture of dataset.fixtures ?? []) {
      if (
        !dataset.clubs.byId[fixture.homeId] ||
        !dataset.clubs.byId[fixture.awayId] ||
        fixture.homeId === fixture.awayId
      )
        context.addIssue({ code: 'custom', path: ['fixtures'], message: 'Confronto inválido' });
    }
    if (
      dataset.fixtures &&
      new Set(dataset.fixtures.map((fixture) => fixture.id)).size !== dataset.fixtures.length
    )
      context.addIssue({
        code: 'custom',
        path: ['fixtures'],
        message: 'Identificador de partida duplicado',
      });
  });
export type WorldDataset = z.infer<typeof worldDatasetSchema>;
