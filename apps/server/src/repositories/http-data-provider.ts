import { worldDatasetSchema, type WorldDataset } from '@football/shared';
import {
  domainError,
  failure,
  parseBoundary,
  type DataProvider,
  type Result,
} from '@football/domain';

export class HttpDataProvider implements DataProvider {
  constructor(
    private readonly url: string,
    private readonly token?: string,
    private readonly request: typeof fetch = fetch,
  ) {}
  async load(): Promise<Result<WorldDataset>> {
    try {
      const response = await this.request(this.url, {
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        return failure(domainError('VALIDATION_ERROR', 'O provedor de dados não respondeu'));
      return parseBoundary(worldDatasetSchema, await response.json());
    } catch {
      return failure(
        domainError('VALIDATION_ERROR', 'Não foi possível carregar os dados licenciados'),
      );
    }
  }
}
