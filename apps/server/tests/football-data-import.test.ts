import { describe, expect, it } from 'vitest';
import { stableId, success, executeCommand, importDataset, createWorld } from '@football/domain';
import { convertFootballData } from '../src/providers/football-data-import.js';
import { LeagueService } from '../src/application/league-service.js';
import { LocalLeagueRepository } from '../src/repositories/local-league-repository.js';

const now = Date.parse('2026-10-26T15:00:00Z');
function fixture() {
  return {
    teams: Array.from({ length: 20 }, (_, team) => ({
      id: team + 1000,
      name: `Clube de teste ${team}`,
      tla: `T${team}`,
      venue: `Campo ${team}`,
      squad: Array.from({ length: 12 }, (_, slot) => ({
        id: team * 100 + slot + 1,
        name: `Atleta de teste ${team}-${slot}`,
        position: slot === 0 ? 'Goalkeeper' : 'Midfield',
        dateOfBirth: '1998-05-01',
        nationality: 'Brazil',
      })),
    })),
  };
}
describe('base real normalizada', () => {
  it('importa identidades, mantém referências e confirma vínculos duplicados', () => {
    const input = fixture();
    const duplicate = input.teams[0]?.squad[1];
    if (!duplicate || !input.teams[1]) throw new Error('Fixture incompleta');
    input.teams[1].squad.push(duplicate);
    const { dataset } = convertFootballData(input, now, new Map([[duplicate.id, 1001]]));
    expect(dataset.clubs.ids).toHaveLength(20);
    expect(dataset.players.ids).toHaveLength(240);
    expect(dataset.players.byId[stableId(12, duplicate.id)]?.clubId).toBe(stableId(11, 1001));
    expect(dataset.players.byId[stableId(12, duplicate.id)]?.age).toBe(28);
    expect(dataset.fixtures?.filter((fixture) => !fixture.group)).toHaveLength(380);
    expect(dataset.fixtures?.some((fixture) => fixture.group)).toBe(true);
    expect(dataset.license).toContain('não dados oficiais');
    expect(() => convertFootballData(input, now)).toThrow('Vínculo duplicado');
  });
  it('omite registros incompletos, recusa base parcial e respeita o clube escolhido', async () => {
    const input = fixture();
    const extra = input.teams[0]?.squad[1];
    if (!extra || !input.teams[0]) throw new Error('Fixture incompleta');
    const incomplete = {
      ...input,
      teams: input.teams.map((team, index) =>
        index === 0
          ? { ...team, squad: [...team.squad, { ...extra, id: 999999, dateOfBirth: null }] }
          : team,
      ),
    };
    const { dataset, excluded } = convertFootballData(incomplete, now);
    expect(excluded).toHaveLength(1);
    expect(() => convertFootballData({ teams: [] }, now)).toThrow();
    const repo = new LocalLeagueRepository(undefined);
    const service = new LeagueService(repo, () => now, { load: async () => success(dataset) });
    expect((await service.catalog()).imported).toBe(true);
    const id = await service.create(
      { userId: 'real-data-test', name: 'Teste', guest: true },
      { name: 'Real', mode: 'offline', clubId: stableId(11, 1010), assignment: 'chosen' },
    );
    expect((await repo.load(id))?.state.participants[0]?.clubId).toBe(stableId(11, 1010));
  });
  it('preserva a Série A e a ausência de copas quando só essa divisão foi importada', () => {
    const { dataset } = convertFootballData(fixture(), now);
    const generated = createWorld({
      id: stableId(90, 2),
      userId: 'season-data-test',
      name: 'Teste',
      mode: 'offline',
      now,
    });
    if (!generated.ok) throw new Error(generated.error.message);
    const imported = importDataset(generated.value, dataset);
    if (!imported.ok) throw new Error(imported.error.message);
    const event = executeCommand(
      { ...imported.value, status: 'finished' },
      { type: 'new-season' },
      'season-data-test',
      now,
      stableId(91, 1),
    );
    expect(event.ok).toBe(true);
    if (!event.ok) throw new Error(event.error.message);
    expect(
      Object.values(event.value.patch.clubs?.byId ?? {}).every((club) => club.division === 'A'),
    ).toBe(true);
    expect(event.value.patch.cups).toEqual([]);
  });
});
