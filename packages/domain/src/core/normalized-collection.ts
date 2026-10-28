import { entityIdSchema } from '@football/shared';
import { domainError } from './domain-error.js';
import { failure, success, type Result } from './result.js';
import { parseBoundary } from './validation.js';

export class NormalizedCollection<T extends Readonly<{ id: string }>> {
  private constructor(
    readonly ids: readonly string[],
    readonly byId: Readonly<Record<string, T>>,
  ) {
    Object.freeze(this);
  }

  static create<T extends Readonly<{ id: string }>>(
    entities: readonly T[],
  ): Result<NormalizedCollection<T>> {
    const byId: Record<string, T> = {};
    const ids: string[] = [];
    for (const entity of entities) {
      const identifier = parseBoundary(entityIdSchema, entity.id);
      if (!identifier.ok) {
        return identifier;
      }
      if (Object.hasOwn(byId, entity.id)) {
        return failure(domainError('DUPLICATE_ENTITY', 'Identificador já cadastrado'));
      }
      ids.push(entity.id);
      byId[entity.id] = Object.freeze({ ...entity });
    }
    return success(new NormalizedCollection(Object.freeze(ids), Object.freeze(byId)));
  }

  findById(id: string): T | undefined {
    return Object.hasOwn(this.byId, id) ? this.byId[id] : undefined;
  }

  add(entity: T): Result<NormalizedCollection<T>> {
    return NormalizedCollection.create([...Object.values(this.byId), entity]);
  }

  replace(entity: T): Result<NormalizedCollection<T>> {
    if (!this.findById(entity.id)) {
      return failure(domainError('ENTITY_NOT_FOUND', 'Entidade não encontrada'));
    }
    return NormalizedCollection.create(
      Object.values(this.byId).map((current) => (current.id === entity.id ? entity : current)),
    );
  }

  remove(id: string): Result<NormalizedCollection<T>> {
    if (!this.findById(id)) {
      return failure(domainError('ENTITY_NOT_FOUND', 'Entidade não encontrada'));
    }
    return NormalizedCollection.create(
      Object.values(this.byId).filter((entity) => entity.id !== id),
    );
  }
}
