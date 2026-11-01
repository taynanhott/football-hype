import { z } from 'zod';
export const snapshotCacheSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  hashes: z
    .record(z.string().max(80), z.string().regex(/^[a-f0-9]{64}$/))
    .refine((value) => Object.keys(value).length <= 100),
});
export type SnapshotCacheManifest = z.infer<typeof snapshotCacheSchema>;
