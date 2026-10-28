import { readFile, stat } from 'node:fs/promises';
import {
  domainError,
  failure,
  parseBoundary,
  type DataProvider,
  type Result,
} from '@football/domain';
import { worldDatasetSchema, type WorldDataset } from '@football/shared';

export class FileDataProvider implements DataProvider {
  private cached: { version: string; result: Promise<Result<WorldDataset>> } | undefined;
  constructor(private readonly path: string) {}
  async load(): Promise<Result<WorldDataset>> {
    try {
      const info = await stat(this.path);
      const version = info.mtimeMs + ':' + info.size;
      if (this.cached?.version === version) return await this.cached.result;
      const result = readFile(this.path, 'utf8').then((content) =>
        parseBoundary(worldDatasetSchema, JSON.parse(content)),
      );
      this.cached = { version, result };
      const loaded = await result;
      if (!loaded.ok && this.cached?.result === result) this.cached = undefined;
      return loaded;
    } catch {
      this.cached = undefined;
      return failure(
        domainError('VALIDATION_ERROR', 'Não foi possível abrir a base de dados importada'),
      );
    }
  }
}
