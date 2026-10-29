import { domainError, failure, parseBoundary, type DataProvider } from '@football/domain';
import { worldDatasetSchema } from '@football/shared';
export function datasetProvider(assets: Fetcher): DataProvider {
  return {
    async load() {
      const response = await assets.fetch('https://assets.local/player-database.json');
      if (!response.ok)
        return failure(domainError('VALIDATION_ERROR', 'Base de jogadores indisponível'));
      return parseBoundary(worldDatasetSchema, await response.json());
    },
  };
}
