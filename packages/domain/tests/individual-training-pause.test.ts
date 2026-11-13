import { describe, expect, it } from 'vitest';
import {
  createWorld,
  advanceGameDays,
  executeCommand,
  applyEvent,
  playNextBatch,
} from '../src/index.js';
import { emptyTrainingProgression } from '../src/game/training-progression.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';

const now = Date.parse('2026-01-15T15:00:00Z');
const day = 86400000;
function setup(age = 25) {
  const state = unwrap(
    createWorld({ id: IDS.league, userId: IDS.user, name: 'Treino pausado', mode: 'offline', now }),
  );
  const club = state.clubs.byId[state.participants[0]!.clubId]!;
  const player = state.players.byId[club.playerIds[0]!]!;
  state.players = {
    ...state.players,
    byId: { ...state.players.byId, [player.id]: { ...player, age, overall: 75, potential: 90 } },
  };
  state.fixtures = [];
  state.lastProcessedAt = now;
  state.cups = [];
  state.competitionDraws = [];
  const center = state.centers.byId[club.trainingCenterId]!;
  state.centers = {
    ...state.centers,
    byId: {
      ...state.centers.byId,
      [center.id]: {
        ...center,
        operations: {
          load: 'moderate',
          fitness: [player.id],
          medical: [player.id],
          syringe: false,
          individual: [{ playerId: player.id, startedAt: now - 10 * day, endsAt: now + 2 * day }],
          progression: { [player.id]: { ...emptyTrainingProgression(), declineProgress: 0.5 } },
        },
      },
    },
  };
  state.injuries = { [player.id]: 3 };
  state.development = { [player.id]: 0.4 };
  return { state, club, player, centerId: center.id };
}
describe('pausa e remoção de atendimentos individuais', () => {
  it('retoma o prazo salvo quando a recuperação termina numa partida do clube', () => {
    const { state, club, player, centerId } = setup();
    const center = state.centers.byId[centerId]!;
    state.centers = {
      ...state.centers,
      byId: {
        ...state.centers.byId,
        [centerId]: {
          ...center,
          operations: {
            ...center.operations!,
            individual: [
              {
                playerId: player.id,
                startedAt: now - 10 * day,
                endsAt: now + 2 * day,
                pausedAt: now - 3 * day,
              },
            ],
          },
        },
      },
    };
    state.injuries = { [player.id]: 1 };
    state.fixtures = [
      {
        id: 'recovery-cycle',
        competitionId: 'serie-a',
        round: 1,
        homeId: club.id,
        awayId: state.clubs.ids.find((id) => id !== club.id)!,
        scheduledAt: now,
      },
    ];
    const next = unwrap(playNextBatch(state, now));
    expect(next.injuries[player.id]).toBe(0);
    const plan = next.centers.byId[centerId]!.operations!.individual[0]!;
    expect(plan.pausedAt).toBeUndefined();
    expect(plan.endsAt - next.lastProcessedAt).toBe(5 * day);
  });
  it.each([25, 38])('lesionado de %i anos não evolui nem consome o ciclo', (age) => {
    const { state, player, centerId } = setup(age);
    const paused = advanceGameDays(state, now + 5 * day);
    const plan = paused.centers.byId[centerId]!.operations!.individual[0]!;
    expect(plan.pausedAt).toBe(now);
    expect(plan.endsAt).toBe(now + 2 * day);
    expect(paused.players.byId[player.id]!.overall).toBe(75);
    expect(paused.development[player.id]).toBe(0.4);
    expect(
      paused.centers.byId[centerId]!.operations!.progression?.[player.id]?.declineProgress,
    ).toBe(0.5);
    expect(paused.centers.byId[centerId]!.operations!.cycleBonuses?.[player.id]).toBeUndefined();
    expect(
      advanceGameDays(paused, now + 5 * day).centers.byId[centerId]!.operations!.individual[0],
    ).toEqual(plan);
    const healed = { ...paused, lastProcessedAt: now + 5 * day, injuries: { [player.id]: 0 } };
    const resumed = advanceGameDays(healed, now + 5 * day);
    const active = resumed.centers.byId[centerId]!.operations!.individual[0]!;
    expect(active.pausedAt).toBeUndefined();
    expect(active.endsAt).toBe(now + 7 * day);
    expect(
      advanceGameDays(resumed, now + 5 * day).centers.byId[centerId]!.operations!.individual[0]!
        .endsAt,
    ).toBe(active.endsAt);
  });
  it.each(['fitness', 'medical', 'individual'] as const)(
    'permite remover de %s sem cobrar ou devolver dinheiro',
    (service) => {
      const { state, club, player, centerId } = setup();
      const command = {
        type: 'management' as const,
        action: 'center' as const,
        target: `remove-${service}`,
        playerId: player.id,
      };
      const next = unwrap(
        applyEvent(state, unwrap(executeCommand(state, command, IDS.user, now, IDS.secondPlayer))),
      );
      const ops = next.centers.byId[centerId]!.operations!;
      expect(
        service === 'individual'
          ? ops.individual.some((plan) => plan.playerId === player.id)
          : ops[service].includes(player.id),
      ).toBe(false);
      expect(next.clubs.byId[club.id]!.balance.cents).toBe(club.balance.cents);
      expect(next.injuries[player.id]).toBe(3);
      expect(next.players.byId[player.id]!.overall).toBe(75);
    },
  );
  it('recusa iniciar ciclo enquanto lesionado e remover atleta de outro clube', () => {
    const { state, player, club } = setup();
    expect(
      executeCommand(
        state,
        { type: 'management', action: 'center', target: 'individual', playerId: player.id },
        IDS.user,
        now,
        IDS.secondPlayer,
      ).ok,
    ).toBe(false);
    const other = Object.values(state.players.byId).find((p) => p.clubId && p.clubId !== club.id)!;
    expect(
      executeCommand(
        state,
        { type: 'management', action: 'center', target: 'remove-medical', playerId: other.id },
        IDS.user,
        now,
        IDS.secondPlayer,
      ).ok,
    ).toBe(false);
  });
});
