import { z } from 'zod';
import { entityIdSchema, uniqueIdsSchema } from './primitives.js';

export function normalizedSchema<T extends z.ZodType<{ readonly id: string }>>(entitySchema: T) {
  return z
    .strictObject({
      ids: uniqueIdsSchema,
      byId: z.record(entityIdSchema, entitySchema).readonly(),
    })
    .superRefine((collection, context) => {
      const ids = new Set(collection.ids);
      for (const id of collection.ids) {
        if (!Object.hasOwn(collection.byId, id)) {
          context.addIssue({ code: 'custom', path: ['byId', id], message: 'Entidade ausente' });
        }
      }
      for (const [id, entity] of Object.entries(collection.byId)) {
        if (!ids.has(id) || entity.id !== id) {
          context.addIssue({ code: 'custom', path: ['byId', id], message: 'Índice inconsistente' });
        }
      }
    })
    .readonly();
}
