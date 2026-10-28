import type { Result } from './result.js';

export interface Repository<T extends Readonly<{ id: string }>> {
  findById(id: string): Promise<Result<T | null>>;
  save(entity: T): Promise<Result<void>>;
}
