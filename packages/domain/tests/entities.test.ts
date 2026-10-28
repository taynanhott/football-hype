import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clubToSnapshot,
  createClub,
  createLeague,
  createPlayer,
  createStadium,
  createTrainingCenter,
  playerToSnapshot,
  stadiumCapacity,
} from '../src/index.js';
import { DOMAIN_LIMITS } from '@football/shared';
import {
  clubInput,
  IDS,
  leagueInput,
  playerInput,
  stadiumInput,
  trainingCenterInput,
  unwrap,
} from '../../../tests/fixtures/domain.js';

describe('Player', () => {
  it('cria os objetos de valor e preserva todos os atributos da carta', () => {
    const input = playerInput();
    const player = unwrap(createPlayer(input));
    expect(player.age.value).toBe(input.age);
    expect(player.overall.value).toBe(input.overall);
    expect(player.potential.value).toBe(input.potential);
    expect(player.morale.value).toBe(input.morale);
    expect(player.marketValue.cents).toBe(input.marketValue.cents);
    expect(player.salary.cents).toBe(input.salary.cents);
    expect(playerToSnapshot(player)).toEqual(input);
  });

  it('aceita atleta sem contrato e serializa sem perder dados', () => {
    const input = playerInput({ clubId: null, position: 'GK' });
    const player = unwrap(createPlayer(input));
    const restored = unwrap(createPlayer(JSON.parse(JSON.stringify(playerToSnapshot(player)))));
    expect(playerToSnapshot(restored)).toEqual(input);
  });

  it('rejeita potencial inferior ao overall com caminho de erro', () => {
    expect(createPlayer(playerInput({ overall: 90, potential: 80 }))).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_ERROR', issues: [{ path: 'potential' }] },
    });
  });

  it.each([
    { fitness: -1 },
    { fitness: 101 },
    { shirtNumber: 0 },
    { shirtNumber: 100 },
    { appearances: -1 },
    { nationality: 'Brasil' },
    { position: 'invalid' },
    { id: 'invalid' },
    { name: ' ' },
    { unknown: true },
    { appearance: { skinTone: 'invalid' } },
  ])('rejeita atributos inválidos %j', (changes) => {
    expect(createPlayer({ ...playerInput(), ...changes }).ok).toBe(false);
  });

  it('copia a entrada e congela o estado do jogador', () => {
    const input = { ...playerInput(), appearance: { ...playerInput().appearance } };
    const player = unwrap(createPlayer(input));
    input.appearance.hairStyle = 'bald';
    expect(player.appearance.hairStyle).toBe('curly');
    expect(Object.isFrozen(player)).toBe(true);
    expect(Object.isFrozen(player.appearance)).toBe(true);
    expect(Reflect.set(player, 'name', 'Alterado')).toBe(false);
    expect(Object.isFrozen(playerToSnapshot(player))).toBe(true);
  });
});

describe('Club', () => {
  it('normaliza espaços do nome e mantém referências e dinheiro', () => {
    const input = clubInput({ name: ' Aurora FC ' });
    const club = unwrap(createClub(input));
    expect(clubToSnapshot(club)).toEqual({ ...input, name: 'Aurora FC' });
    expect(Object.isFrozen(club)).toBe(true);
    expect(Object.isFrozen(club.playerIds)).toBe(true);
  });

  it('rejeita jogadores repetidos e saldo inválido', () => {
    expect(createClub(clubInput({ playerIds: [IDS.player, IDS.player] })).ok).toBe(false);
    expect(createClub(clubInput({ balance: { cents: -1, currency: 'BRL' } })).ok).toBe(false);
  });
});

describe('League', () => {
  it('aceita identificadores de usuário compatíveis com Firebase Authentication', () => {
    const userId = 'firebaseUserUidWith28Chars123';
    expect(
      createLeague(
        leagueInput({ administratorId: userId, participants: [{ userId, clubId: IDS.club }] }),
      ).ok,
    ).toBe(true);
    expect(createLeague(leagueInput({ administratorId: ' ' })).ok).toBe(false);
  });
  it('cria liga offline e liga multiplayer sem dependência de infraestrutura', () => {
    expect(createLeague(leagueInput()).ok).toBe(true);
    const multiplayer = unwrap(
      createLeague(
        leagueInput({
          mode: 'multiplayer',
          participants: [
            { userId: IDS.user, clubId: IDS.club },
            { userId: IDS.secondUser, clubId: IDS.secondClub },
          ],
        }),
      ),
    );
    expect(Object.isFrozen(multiplayer.participants)).toBe(true);
    expect(Object.isFrozen(multiplayer.participants[0])).toBe(true);
  });

  it.each([
    { administratorId: IDS.secondUser },
    { clubIds: [IDS.club, IDS.club] },
    { clubIds: [] },
    { season: 0 },
    { participants: [] },
    {
      participants: [
        { userId: IDS.user, clubId: IDS.club },
        { userId: IDS.user, clubId: IDS.secondClub },
      ],
    },
    {
      participants: [
        { userId: IDS.user, clubId: IDS.club },
        { userId: IDS.secondUser, clubId: IDS.club },
      ],
    },
    {
      participants: [
        { userId: IDS.user, clubId: IDS.club },
        { userId: IDS.secondUser, clubId: IDS.secondClub },
      ],
    },
  ])('rejeita liga inconsistente %j', (changes) => {
    expect(createLeague({ ...leagueInput(), ...changes }).ok).toBe(false);
  });
});

describe('Stadium', () => {
  it('soma as capacidades dos setores independentes', () => {
    const stadium = unwrap(createStadium(stadiumInput()));
    expect(stadiumCapacity(stadium)).toBe(25_000);
    expect(Object.isFrozen(stadium.sectors)).toBe(true);
    expect(Object.isFrozen(stadium.sectors[0])).toBe(true);
    expect(Object.isFrozen(stadium.commerce)).toBe(true);
  });

  it('preserva a soma para capacidades variadas', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.nat(100_000), fc.nat(100_000), fc.nat(100_000), fc.nat(100_000)),
        (capacities) => {
          const input = stadiumInput();
          const sectors = input.sectors.map((sector, index) => ({
            ...sector,
            capacity: capacities[index] ?? 0,
          }));
          const stadium = unwrap(createStadium({ ...input, sectors }));
          expect(stadiumCapacity(stadium)).toBe(capacities.reduce((sum, value) => sum + value, 0));
        },
      ),
    );
  });

  it('rejeita setores repetidos, ausentes, capacidade negativa e estouro', () => {
    const input = stadiumInput();
    expect(
      createStadium({
        ...input,
        sectors: input.sectors.map((sector) => ({ ...sector, id: 'north' })),
      }).ok,
    ).toBe(false);
    expect(createStadium({ ...input, sectors: input.sectors.slice(1) }).ok).toBe(false);
    expect(
      createStadium({
        ...input,
        sectors: input.sectors.map((sector) => ({ ...sector, capacity: -1 })),
      }).ok,
    ).toBe(false);
    expect(
      createStadium({
        ...input,
        sectors: input.sectors.map((sector) => ({ ...sector, capacity: Number.MAX_SAFE_INTEGER })),
      }).ok,
    ).toBe(false);
  });
});

describe('TrainingCenter', () => {
  it('aceita todos os cinco setores em cada nível configurado', () => {
    fc.assert(
      fc.property(fc.integer(DOMAIN_LIMITS.facilityLevel), (level) => {
        const center = unwrap(
          createTrainingCenter(
            trainingCenterInput({
              levels: {
                fitness: level,
                medical: level,
                scouting: level,
                coaching: level,
                marketing: level,
              },
            }),
          ),
        );
        expect(Object.isFrozen(center)).toBe(true);
        expect(Object.isFrozen(center.levels)).toBe(true);
      }),
    );
  });

  it.each(['fitness', 'medical', 'scouting', 'coaching', 'marketing'])(
    'valida o setor %s',
    (sector) => {
      const input = trainingCenterInput();
      for (const invalid of [0, DOMAIN_LIMITS.facilityLevel.max + 1, 1.5]) {
        expect(
          createTrainingCenter({ ...input, levels: { ...input.levels, [sector]: invalid } }).ok,
        ).toBe(false);
      }
      const missing = { ...input.levels };
      Reflect.deleteProperty(missing, sector);
      expect(createTrainingCenter({ ...input, levels: missing }).ok).toBe(false);
    },
  );
});
