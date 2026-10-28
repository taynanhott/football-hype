import { describe, expect, it } from 'vitest';
import { MATCH_DURATION_MS } from '@football/shared';
import { buildPlayback, samplePlayback, visibleActionMinute } from '../src/three/match-playback';
describe('passes na reprodução 3D', () => {
  const frames = buildPlayback(
    [
      { minute: 0, type: 'kickoff', side: 'home', x: 0, z: 0 },
      { minute: 0.5, type: 'pass', side: 'home', playerId: 'a', targetId: 'b', x: 8, z: 5 },
      { minute: 1, type: 'pass', side: 'home', playerId: 'b', targetId: 'c', x: 10, z: 8 },
      { minute: 1.5, type: 'shot', side: 'home', playerId: 'c', x: 5, z: 25 },
    ],
    ['a', 'b', 'c'],
    ['d'],
  );
  it('reproduz as coordenadas do servidor sem puxar o goleiro ou trocar a origem do chute', () => {
    const spatial = buildPlayback(
      [
        {
          minute: 0,
          type: 'kickoff',
          side: 'home',
          x: 0,
          z: 30,
          endX: 0,
          endZ: 30,
          coordinates: [0, -470, 0, 300, 100, 350],
        },
        {
          minute: 0.5,
          type: 'pass',
          side: 'home',
          playerId: 'b',
          targetId: 'c',
          x: 0,
          z: 30,
          endX: 10,
          endZ: 35,
          coordinates: [0, -470, 0, 300, 100, 350],
        },
        {
          minute: 1,
          type: 'shot',
          side: 'home',
          playerId: 'c',
          x: 10,
          z: 35,
          endX: 0,
          endZ: 52,
          coordinates: [0, -470, 0, 300, 100, 350],
        },
      ],
      ['a', 'b', 'c'],
      [],
    );
    const shot = samplePlayback(spatial, 1);
    expect(shot.ball).toEqual({ x: 10, z: 35 });
    expect(shot.positions.c).toEqual(shot.ball);
    expect(samplePlayback(spatial, 1.2).positions.a).toEqual({ x: 0, z: -47 });
    expect(samplePlayback(spatial, 0.99).ball).toEqual({ x: 10, z: 35 });
  });
  it('mantém espaço entre jogadores até quando suas trajetórias se cruzam', () => {
    const frames = buildPlayback(
      [
        { minute: 0, type: 'kickoff', side: 'home', x: 0, z: 0, coordinates: [-20, 0, 20, 0] },
        { minute: 1, type: 'dribble', side: 'home', x: 0, z: 0, coordinates: [20, 0, -20, 0] },
        { minute: 2, type: 'dribble', side: 'home', x: 0, z: 0, coordinates: [20, 0, -20, 0] },
      ],
      ['a'],
      ['b'],
    );
    const { positions } = samplePlayback(frames, 1.4);
    expect(
      Math.hypot(positions.a!.x - positions.b!.x, positions.a!.z - positions.b!.z),
    ).toBeGreaterThanOrEqual(1.6);
  });
  it('para uma bola defendida antes da linha e só anuncia gol após a trajetória terminar', () => {
    const actions = [
      {
        minute: 0,
        type: 'kickoff' as const,
        side: 'home' as const,
        x: 0,
        z: 30,
        coordinates: [0, 300, 0, 470],
      },
      {
        minute: 1,
        type: 'shot' as const,
        side: 'home' as const,
        playerId: 'a',
        x: 0,
        z: 30,
        endX: 0,
        endZ: 52,
        onTarget: true,
        outcome: 'saved' as const,
        keeperId: 'b',
        keeperDive: 'left' as const,
        coordinates: [0, 300, 0, 470],
      },
      {
        minute: 2,
        type: 'save' as const,
        side: 'away' as const,
        playerId: 'b',
        x: 0,
        z: 47,
        endX: 0,
        endZ: 47,
        coordinates: [0, 300, 0, 470],
      },
    ];
    const frames = buildPlayback(actions, ['a'], ['b'], ['b']);
    expect(samplePlayback(frames, 1.95).ball.z).toBeLessThan(51);
    expect(samplePlayback(frames, 1.5).frame?.action.keeperDive).toBe('left');
    const goals = [
      { ...actions[1]!, outcome: 'goal' as const },
      { ...actions[1]!, type: 'goal' as const, outcome: 'goal' as const },
      { ...actions[0]!, minute: 2 },
    ];
    expect(visibleActionMinute(goals, 1)).toBe(1.88);
    expect(visibleActionMinute(goals, 1)).toBeGreaterThan(1.5);
  });
  it('mostra o cruzamento de escanteio pelo alto', () => {
    const frames = buildPlayback(
      [
        {
          minute: 0,
          type: 'corner',
          side: 'home',
          x: 31.5,
          z: 49.5,
          coordinates: [315, 495, 0, 390],
        },
        {
          minute: 1,
          type: 'cross',
          side: 'home',
          playerId: 'a',
          targetId: 'b',
          x: 31.5,
          z: 49.5,
          endX: 0,
          endZ: 39,
          arc: 7,
          endHeight: 1.8,
          coordinates: [315, 495, 0, 390],
        },
        {
          minute: 2,
          type: 'shot',
          side: 'home',
          playerId: 'b',
          x: 0,
          z: 39,
          endX: 0,
          endZ: 52,
          header: true,
          outcome: 'goal',
          coordinates: [315, 495, 0, 390],
        },
      ],
      ['a', 'b'],
      [],
    );
    expect(samplePlayback(frames, 1.5).height).toBeGreaterThan(5);
  });
  it('encerra a partida em 90 segundos', () => {
    expect(MATCH_DURATION_MS).toBe(90000);
  });
  it('a bola parte do passador e chega ao recebedor, que não corre junto da bola', () => {
    const departure = samplePlayback(frames, 0.5);
    const middle = samplePlayback(frames, 0.75);
    const reception = samplePlayback(frames, 0.99);
    expect(departure.ball).toEqual(departure.positions.a);
    expect(reception.ball).toEqual(reception.positions.b);
    expect(middle.ball).not.toEqual(middle.positions.a);
    expect(middle.ball).not.toEqual(middle.positions.b);
    expect(departure.positions.a).toEqual(reception.positions.a);
  });
  it('o recebedor mantém a posse para o passe seguinte', () => {
    const previous = samplePlayback(frames, 0.9999);
    const next = samplePlayback(frames, 1);
    expect(next.ball).toEqual(previous.ball);
    expect(next.positions.b).toEqual(previous.positions.b);
  });
});
