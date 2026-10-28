import { ApiFootballDataProvider } from './api-football-provider.js';
import { FileDataProvider } from '../repositories/file-data-provider.js';
import { environment } from '../config.js';
if (!environment.DATASET_FILE)
  throw new Error('Configure DATASET_FILE com a base local de reserva.');
if (!environment.API_FOOTBALL_KEY) throw new Error('Configure API_FOOTBALL_KEY no servidor.');
const provider = new ApiFootballDataProvider(new FileDataProvider(environment.DATASET_FILE), {
  key: environment.API_FOOTBALL_KEY,
  directory: environment.API_FOOTBALL_CACHE_DIR,
  league: environment.API_FOOTBALL_LEAGUE,
  season: environment.API_FOOTBALL_SEASON,
});
const result = await provider.bootstrap();
if (!result.ok) throw new Error(result.error.message);
console.log(
  JSON.stringify(
    {
      defaultSaved: true,
      api: await provider.status(),
      clubs: result.value.clubs.ids.length,
      players: result.value.players.ids.length,
      source: result.value.source,
      notice:
        'Uma chamada devolve somente uma página. A base de reserva preserva a cobertura local existente.',
    },
    null,
    2,
  ),
);
