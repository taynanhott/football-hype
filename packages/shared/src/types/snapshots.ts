import type { z } from 'zod';
import type { clubSchema } from '../schemas/club.js';
import type { leagueSchema } from '../schemas/league.js';
import type { playerSchema } from '../schemas/player.js';
import type { currencySchema, moneySchema } from '../schemas/primitives.js';
import type { stadiumSchema } from '../schemas/stadium.js';
import type { trainingCenterSchema } from '../schemas/training-center.js';

export type Currency = z.infer<typeof currencySchema>;
export type MoneySnapshot = z.infer<typeof moneySchema>;
export type PlayerSnapshot = z.infer<typeof playerSchema>;
export type ClubSnapshot = z.infer<typeof clubSchema>;
export type LeagueSnapshot = z.infer<typeof leagueSchema>;
export type StadiumSnapshot = z.infer<typeof stadiumSchema>;
export type TrainingCenterSnapshot = z.infer<typeof trainingCenterSchema>;
