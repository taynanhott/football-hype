import { z } from 'zod';

export const environment = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(2567),
    HOST: z.string().default('127.0.0.1'),
    CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
    STORE: z.enum(['file', 'firestore', 'memory']).default('file'),
    DATA_DIR: z.string().default('.local/leagues'),
    GCLOUD_PROJECT: z.string().default('demo-football-manager'),
    SCHEDULER_SECRET: z.string().min(32).optional(),
    REQUIRE_APP_CHECK: z.enum(['true', 'false']).default('false'),
    TEST_NOW: z.iso.datetime().optional(),
    DATASET_FILE: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(1).optional(),
    ),
    DATASET_URL: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),
    DATASET_TOKEN: z.string().optional(),
    API_FOOTBALL_KEY: z.string().default(''),
    API_FOOTBALL_CACHE_DIR: z.string().default('.local/datasets/api-football'),
    API_FOOTBALL_LEAGUE: z.coerce.number().int().positive().default(71),
    API_FOOTBALL_SEASON: z.coerce.number().int().min(2000).default(2026),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === 'production' &&
      (value.GCLOUD_PROJECT.startsWith('demo-') || !value.CLIENT_ORIGIN.startsWith('https://'))
    )
      context.addIssue({
        code: 'custom',
        message: 'Produção exige projeto Firebase próprio e origem HTTPS',
      });
    if (
      value.NODE_ENV === 'production' &&
      (value.STORE !== 'firestore' || value.REQUIRE_APP_CHECK !== 'true')
    )
      context.addIssue({ code: 'custom', message: 'Produção exige Firestore e App Check' });
    if (value.TEST_NOW && value.NODE_ENV !== 'test')
      context.addIssue({ code: 'custom', message: 'Relógio fixo só é permitido em testes' });
  })
  .parse(process.env);
