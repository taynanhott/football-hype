import { z } from 'zod';
import type { Result } from '@football/domain';
import { ExternalSources } from './external-sources.js';

const source = z
  .enum(['football-data', 'api-football', 'sportsdb', 'wikidata', 'weather', 'surroundings', 'fx'])
  .safeParse(process.argv[2]);
if (!source.success) {
  console.error(
    'Use football-data, api-football, sportsdb, wikidata, weather, surroundings ou fx, seguido dos parâmetros.',
  );
  process.exitCode = 1;
} else {
  const sources = new ExternalSources({
    footballDataToken: process.env.FOOTBALL_DATA_TOKEN,
    apiFootballKey: process.env.API_FOOTBALL_KEY,
    sportsDbKey: process.env.SPORTSDB_KEY,
  });
  const first = process.argv[3];
  const second = process.argv[4];
  let result: Result<unknown>;
  switch (source.data) {
    case 'football-data':
      result = await sources.footballDataTeam(first);
      break;
    case 'api-football':
      result = await sources.apiFootballSquad(first);
      break;
    case 'sportsdb':
      result = await sources.sportsDbSquad(first);
      break;
    case 'wikidata':
      result = await sources.wikidata(first);
      break;
    case 'weather':
      result = await sources.weather({ latitude: first, longitude: second });
      break;
    case 'surroundings':
      result = await sources.surroundings({ latitude: first, longitude: second });
      break;
    case 'fx':
      result = await sources.exchange(first, second);
      break;
  }
  console.log(JSON.stringify(result.ok ? result.value : result.error, null, 2));
  if (!result.ok) process.exitCode = 1;
}
