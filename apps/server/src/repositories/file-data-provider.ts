import { readFile } from 'node:fs/promises';
import {
  domainError,
  failure,
  parseBoundary,
  type DataProvider,
  type Result,
} from '@football/domain';
import { worldDatasetSchema, type WorldDataset } from '@football/shared';

export class FileDataProvider implements DataProvider {
  constructor(private readonly path: string) {}
  async load(): Promise<Result<WorldDataset>> {
    try {
      return parseBoundary(worldDatasetSchema, JSON.parse(await readFile(this.path, 'utf8')));
    } catch {
      return failure(
        domainError('VALIDATION_ERROR', 'Não foi possível abrir a base de dados importada'),
      );
    }
  }
}
