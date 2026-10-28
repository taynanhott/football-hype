import { z } from 'zod';
import { domainError, failure, parseBoundary, type Result } from '@football/domain';
import { currencySchema } from '@football/shared';

const numericId = z.coerce.number().int().positive();
const coordinatesSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});
const footballDataTeamSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  squad: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      position: z.string().nullish(),
      dateOfBirth: z.string().nullish(),
      nationality: z.string().nullish(),
    }),
  ),
});
const apiFootballSchema = z.object({
  response: z.array(
    z.object({
      team: z.object({ id: z.number().int(), name: z.string() }),
      players: z.array(
        z.object({
          id: z.number().int(),
          name: z.string(),
          age: z.number().int().nullable(),
          number: z.number().int().nullable(),
          position: z.string(),
        }),
      ),
    }),
  ),
});
const sportsDbSchema = z.object({
  player: z
    .array(
      z.object({
        idPlayer: z.string(),
        strPlayer: z.string(),
        strNationality: z.string().nullable(),
        strPosition: z.string().nullable(),
        dateBorn: z.string().nullable(),
      }),
    )
    .nullable(),
});
const wikidataSchema = z.object({
  entities: z.record(
    z.string(),
    z.object({
      id: z.string(),
      labels: z.record(z.string(), z.object({ language: z.string(), value: z.string() })),
    }),
  ),
});
const weatherSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    weather_code: z.number().int(),
    wind_speed_10m: z.number(),
  }),
});
const surroundingsSchema = z.object({
  elements: z.array(
    z.object({
      type: z.enum(['node', 'way', 'relation']),
      id: z.number().int(),
      tags: z.record(z.string(), z.string()).optional(),
      lat: z.number().optional(),
      lon: z.number().optional(),
      center: z.object({ lat: z.number(), lon: z.number() }).optional(),
    }),
  ),
});
const exchangeSchema = z.object({
  date: z.iso.date(),
  base: z.string(),
  quote: z.string(),
  rate: z.number().positive(),
});

type SourceKeys = Readonly<{
  footballDataToken?: string | undefined;
  apiFootballKey?: string | undefined;
  sportsDbKey?: string | undefined;
}>;
export class ExternalSources {
  constructor(
    private readonly keys: SourceKeys = {},
    private readonly request: typeof fetch = fetch,
  ) {}
  async footballDataTeam(input: unknown): Promise<Result<z.infer<typeof footballDataTeamSchema>>> {
    const id = parseBoundary(numericId, input);
    if (!id.ok) return id;
    if (!this.keys.footballDataToken)
      return failure(domainError('VALIDATION_ERROR', 'Configure FOOTBALL_DATA_TOKEN no servidor'));
    return this.read(`https://api.football-data.org/v4/teams/${id.value}`, footballDataTeamSchema, {
      headers: { 'X-Auth-Token': this.keys.footballDataToken },
    });
  }
  async apiFootballSquad(input: unknown): Promise<Result<z.infer<typeof apiFootballSchema>>> {
    const id = parseBoundary(numericId, input);
    if (!id.ok) return id;
    if (!this.keys.apiFootballKey)
      return failure(domainError('VALIDATION_ERROR', 'Configure API_FOOTBALL_KEY no servidor'));
    return this.read(
      `https://v3.football.api-sports.io/players/squads?team=${id.value}`,
      apiFootballSchema,
      { headers: { 'x-apisports-key': this.keys.apiFootballKey } },
    );
  }
  async sportsDbSquad(input: unknown): Promise<Result<z.infer<typeof sportsDbSchema>>> {
    const id = parseBoundary(numericId, input);
    if (!id.ok) return id;
    const key = this.keys.sportsDbKey ?? '123';
    if (!/^[a-zA-Z0-9]+$/.test(key))
      return failure(domainError('VALIDATION_ERROR', 'Chave TheSportsDB inválida'));
    return this.read(
      `https://www.thesportsdb.com/api/v1/json/${key}/lookup_all_players.php?id=${id.value}`,
      sportsDbSchema,
    );
  }
  async wikidata(input: unknown): Promise<Result<z.infer<typeof wikidataSchema>>> {
    const id = parseBoundary(z.string().regex(/^Q[1-9][0-9]{0,11}$/), input);
    if (!id.ok) return id;
    return this.read(
      `https://www.wikidata.org/wiki/Special:EntityData/${id.value}.json`,
      wikidataSchema,
      { headers: { 'User-Agent': 'LinhaDeFundo/1.0 (football manager data tools)' } },
    );
  }
  async weather(input: unknown): Promise<Result<z.infer<typeof weatherSchema>>> {
    const point = parseBoundary(coordinatesSchema, input);
    if (!point.ok) return point;
    return this.read(
      `https://api.open-meteo.com/v1/forecast?latitude=${point.value.latitude}&longitude=${point.value.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=America%2FSao_Paulo`,
      weatherSchema,
    );
  }
  async surroundings(input: unknown): Promise<Result<z.infer<typeof surroundingsSchema>>> {
    const point = parseBoundary(coordinatesSchema, input);
    if (!point.ok) return point;
    const query = `[out:json][timeout:8];nwr(around:1000,${point.value.latitude},${point.value.longitude})[amenity];out center 100;`;
    return this.read('https://overpass-api.de/api/interpreter', surroundingsSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
  }
  async exchange(base: unknown, quote: unknown): Promise<Result<z.infer<typeof exchangeSchema>>> {
    const currencies = parseBoundary(z.object({ base: currencySchema, quote: currencySchema }), {
      base,
      quote,
    });
    if (!currencies.ok) return currencies;
    return this.read(
      `https://api.frankfurter.dev/v2/rate/${currencies.value.base.toLowerCase()}/${currencies.value.quote.toLowerCase()}`,
      exchangeSchema,
    );
  }
  private async read<T>(
    url: string,
    schema: z.ZodType<T>,
    options: RequestInit = {},
  ): Promise<Result<T>> {
    try {
      const response = await this.request(url, { ...options, signal: AbortSignal.timeout(12000) });
      if (!response.ok)
        return failure(
          domainError(
            'VALIDATION_ERROR',
            response.status === 429
              ? 'Cota do provedor atingida; tente mais tarde'
              : 'Fonte externa indisponível',
          ),
        );
      return parseBoundary(schema, await response.json());
    } catch {
      return failure(domainError('VALIDATION_ERROR', 'Não foi possível consultar a fonte externa'));
    }
  }
}
