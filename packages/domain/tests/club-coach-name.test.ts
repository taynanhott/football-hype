import { describe, expect, it } from 'vitest';
import { clubCoachName, createWorld } from '../src/index.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

describe('nome do treinador do clube', () => {
  const state = unwrap(
    createWorld({
      id: IDS.league,
      userId: IDS.user,
      name: 'Técnicos',
      mode: 'offline',
      now: Date.parse('2026-11-11T15:00:00Z'),
    }),
  );
  const participant = state.participants[0]!;
  const club = { ...state.clubs.byId[participant.clubId]!, coachName: 'Técnico real' };

  it('usa o técnico real para clubes sem participante', () => {
    expect(clubCoachName({ participants: [] }, club)).toBe('Técnico real');
  });
  it('resolve nomes genéricos e ausentes em carreiras antigas sem modificar o clube', () => {
    const legacy = { ...club, name: 'Palmeiras', coachName: 'Treinador do Palmeiras' };
    expect(clubCoachName({ participants: [] }, legacy)).toBe('Abel Ferreira');
    expect(clubCoachName({ participants: [] }, { ...legacy, coachName: undefined })).toBe(
      'Abel Ferreira',
    );
    expect(legacy.coachName).toBe('Treinador do Palmeiras');
  });
  it('prioriza o nome escolhido pelo participante', () => {
    expect(
      clubCoachName(
        {
          participants: [
            {
              ...participant,
              coach: {
                name: 'Marina',
                skin: '#d7a47c',
                hair: 'curto',
                beard: 'nenhuma',
                outfit: '#123456',
                hairColor: '#111111',
                beardColor: '#111111',
                eyeColor: '#111111',
                secondary: '#ffffff',
                outfitStyle: 'agasalho',
                glasses: 'nenhum',
                glassesColor: '#111111',
              },
            },
          ],
        },
        club,
      ),
    ).toBe('Marina');
  });
  it('não atribui o técnico real a um participante sem perfil', () => {
    expect(clubCoachName(state, club)).toBe('Treinador');
  });
});
