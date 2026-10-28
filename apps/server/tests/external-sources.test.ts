import { describe, expect, it, vi } from 'vitest';
import { ExternalSources } from '../src/providers/external-sources.js';

describe('conectores externos', () => {
  it('não consulta fontes com parâmetros inválidos ou sem chave', async () => {
    const request = vi.fn<typeof fetch>();
    const sources = new ExternalSources({}, request);
    expect((await sources.footballDataTeam(1)).ok).toBe(false);
    expect((await sources.apiFootballSquad(1)).ok).toBe(false);
    expect((await sources.footballDataTeam('bad')).ok).toBe(false);
    expect((await sources.apiFootballSquad('bad')).ok).toBe(false);
    expect((await sources.sportsDbSquad('bad')).ok).toBe(false);
    expect((await sources.wikidata('Q1;DROP')).ok).toBe(false);
    expect((await sources.weather({ latitude: 100, longitude: 1 })).ok).toBe(false);
    expect((await sources.surroundings({ latitude: 1, longitude: 181 })).ok).toBe(false);
    expect((await sources.exchange('BAD', 'BRL')).ok).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it('consulta e valida cada provedor sem carregar faces ou escudos', async () => {
    const request = vi.fn<typeof fetch>();
    const sources = new ExternalSources(
      { footballDataToken: 'token', apiFootballKey: 'key' },
      request,
    );
    request.mockResolvedValueOnce(
      Response.json({ id: 1, name: 'Time', squad: [{ id: 2, name: 'Atleta' }] }),
    );
    expect((await sources.footballDataTeam(1)).ok).toBe(true);
    expect(request.mock.calls[0]?.[1]?.headers).toEqual({ 'X-Auth-Token': 'token' });
    request.mockResolvedValueOnce(
      Response.json({
        response: [
          {
            team: { id: 1, name: 'Time' },
            players: [{ id: 2, name: 'Atleta', age: 20, number: 9, position: 'Attacker' }],
          },
        ],
      }),
    );
    expect((await sources.apiFootballSquad(1)).ok).toBe(true);
    request.mockResolvedValueOnce(
      Response.json({
        player: [
          {
            idPlayer: '2',
            strPlayer: 'Atleta',
            strNationality: 'Brazil',
            strPosition: 'Forward',
            dateBorn: '2006-01-01',
          },
        ],
      }),
    );
    expect((await sources.sportsDbSquad(1)).ok).toBe(true);
    request.mockResolvedValueOnce(
      Response.json({
        entities: { Q1: { id: 'Q1', labels: { pt: { language: 'pt', value: 'Teste' } } } },
      }),
    );
    expect((await sources.wikidata('Q1')).ok).toBe(true);
    request.mockResolvedValueOnce(
      Response.json({
        latitude: -23.55,
        longitude: -46.63,
        timezone: 'America/Sao_Paulo',
        current: {
          time: '2026-10-26T12:00',
          temperature_2m: 25,
          weather_code: 0,
          wind_speed_10m: 5,
        },
      }),
    );
    expect((await sources.weather({ latitude: -23.55, longitude: -46.63 })).ok).toBe(true);
    request.mockResolvedValueOnce(
      Response.json({
        elements: [{ type: 'node', id: 1, tags: { amenity: 'cafe' }, lat: -23.55, lon: -46.63 }],
      }),
    );
    expect((await sources.surroundings({ latitude: -23.55, longitude: -46.63 })).ok).toBe(true);
    request.mockResolvedValueOnce(
      Response.json({ date: '2026-10-26', base: 'EUR', quote: 'BRL', rate: 6 }),
    );
    expect((await sources.exchange('EUR', 'BRL')).ok).toBe(true);
  });
  it('retorna falhas controladas para cotas, rede e respostas inesperadas', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(Response.json({ invalid: true }))
      .mockRejectedValueOnce(new Error('offline'));
    const sources = new ExternalSources({}, request);
    for (let index = 0; index < 4; index++)
      expect((await sources.exchange('EUR', 'BRL')).ok).toBe(false);
    expect(
      (await new ExternalSources({ sportsDbKey: '../bad' }, request).sportsDbSquad(1)).ok,
    ).toBe(false);
  });
});
