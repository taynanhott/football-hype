import { describe, expect, it } from 'vitest';
import { createWorld, stableId } from '../src/index.js';
import { agePlayer } from '../src/players/development.js';
import {
  annualDecline,
  expectedTrainingGain,
  emptyTrainingProgression,
  progressTraining,
  officialMatchDevelopment,
} from '../src/game/training-progression.js';
import { unwrap } from '../../../tests/fixtures/domain.js';
const state = unwrap(
  createWorld({
    id: stableId(997, 1),
    userId: 'host',
    name: 'Progressão',
    mode: 'offline',
    now: Date.UTC(2026, 0, 15),
  }),
);
const base = { ...Object.values(state.players.byId)[0]!, age: 25, overall: 80, potential: 80 };
describe('barras de treinamento', () => {
  it('leve regride, moderado mantém e intenso avança o bônus amarelo', () => {
    const previous = { ...emptyTrainingProgression(), buffProgress: 0.5 };
    expect(progressTraining(base, previous, 'light', 1, true).progress.buffProgress).toBeLessThan(
      0.5,
    );
    expect(progressTraining(base, previous, 'moderate', 1, true).progress.buffProgress).toBe(0.5);
    expect(
      progressTraining(base, previous, 'intense', 1, true).progress.buffProgress,
    ).toBeGreaterThan(0.5);
    expect(progressTraining(base, previous, 'intense', 1, false).progress.buffProgress).toBe(0.5);
  });
  it('completa bônus em etapas e limita a +3 sem aumentar o overall base', () => {
    let progress = emptyTrainingProgression();
    for (let i = 0; i < 900; i++) {
      const result = progressTraining(base, progress, 'intense', 1, true);
      progress = result.progress;
      expect(result.overall).toBe(80);
    }
    expect(progress.buff).toBe(3);
    expect(progress.buffProgress).toBe(1);
  });
  it('aplica declínio gradual somente após 33 anos e treino intenso o reduz', () => {
    expect(annualDecline(33, 'light', 1)).toBe(0);
    expect(annualDecline(34, 'intense', 1)).toBeLessThan(annualDecline(34, 'moderate', 1));
    expect(annualDecline(34, 'moderate', 1)).toBeLessThan(annualDecline(34, 'light', 1));
    const older = { ...base, age: 35 };
    const result = progressTraining(
      older,
      { ...emptyTrainingProgression(), declineProgress: 0.9999 },
      'light',
      1,
      true,
    );
    expect(result.overall).toBe(79);
    expect(result.progress.declineProgress).toBeLessThan(0.02);
    expect(agePlayer(older, 1, true).overall).toBe(older.overall);
  });
  it('jogo oficial equivale a intenso e recebe benefícios da instalação e ciclo', () => {
    const match = officialMatchDevelopment(base, 0, emptyTrainingProgression(), 1, false);
    expect(match.progression).toEqual(
      progressTraining(base, emptyTrainingProgression(), 'intense', 1, true).progress,
    );
    expect(
      officialMatchDevelopment(base, 0, emptyTrainingProgression(), 5, false).progression
        .buffProgress,
    ).toBeGreaterThan(match.progression.buffProgress);
    expect(
      officialMatchDevelopment(base, 0, emptyTrainingProgression(), 1, true).progression
        .buffProgress,
    ).toBeCloseTo(match.progression.buffProgress * 1.5);
    const developing = { ...base, overall: 70 };
    expect(
      officialMatchDevelopment(developing, 0, emptyTrainingProgression(), 3, true).development,
    ).toBeCloseTo(0.006 * 3 * 1.5 * 1.5);
  });
  it('participar de jogo pausa a barra vermelha sem descontar overall novamente', () => {
    const veteran = { ...base, age: 36 };
    const result = officialMatchDevelopment(
      veteran,
      0,
      { ...emptyTrainingProgression(), declineProgress: 0.5 },
      3,
      false,
      'light',
    );
    expect(result.player.overall).toBe(80);
    expect(result.progression.declineProgress).toBe(0.5);
  });
  it('projeção usa histórico real e não muda ao alternar a carga selecionada', () => {
    const player = { ...base, overall: 70, potential: 90 };
    const club = state.clubs.byId[player.clubId!]!;
    const center = state.centers.byId[club.trainingCenterId]!;
    const withLoad = (load: 'light' | 'intense') => ({
      ...state,
      centers: {
        ...state.centers,
        byId: {
          ...state.centers.byId,
          [center.id]: {
            ...center,
            operations: {
              load: 'moderate' as const,
              fitness: [],
              medical: [],
              individual: [],
              syringe: false,
              playerLoads: { [player.id]: load },
              trainingHistory: {
                [player.id]: {
                  season: state.season,
                  days: 30,
                  growth: 1.5,
                  bonus: 0.1,
                  decline: 0.3,
                },
              },
            },
          },
        },
      },
    });
    expect(expectedTrainingGain(withLoad('light'), player)).toBe(
      expectedTrainingGain(withLoad('intense'), player),
    );
    const older = { ...player, age: 35 };
    expect(expectedTrainingGain(withLoad('light'), older)).toBe(
      expectedTrainingGain(withLoad('intense'), older),
    );
    expect(expectedTrainingGain(withLoad('light'), older)).toBeLessThan(0);
    expect(expectedTrainingGain(state, player)).toBe(0);
  });
  it('intenso pausa e o ciclo individual zera desgaste sem recuperar overall', () => {
    const player = { ...base, age: 35, overall: 78 };
    const previous = { ...emptyTrainingProgression(), declineProgress: 0.5 };
    expect(progressTraining(player, previous, 'intense', 1, true).progress.declineProgress).toBe(
      0.5,
    );
    const moderate = progressTraining(player, previous, 'moderate', 1, true);
    const light = progressTraining(player, previous, 'light', 1, true);
    expect(moderate.progress.declineProgress).toBeGreaterThan(0.5);
    expect(light.progress.declineProgress).toBeGreaterThan(moderate.progress.declineProgress);
    const individual = progressTraining(player, previous, 'light', 1, true, 1.5, true);
    expect(individual.progress.declineProgress).toBeLessThan(0.5);
    expect(
      progressTraining(player, previous, 'light', 5, true, 1.5, true).progress.declineProgress,
    ).toBeLessThan(individual.progress.declineProgress);
    const zero = progressTraining(
      player,
      { ...previous, declineProgress: 0.001 },
      'light',
      5,
      true,
      1.5,
      true,
    );
    expect(zero.progress.declineProgress).toBe(0);
    expect(zero.overall).toBe(78);
  });
});
