import { describe, expect, it } from 'vitest';
import { matchManagement, type MatchOptions } from '../src/simulation/match-management.js';
import { playerInput } from '../../../tests/fixtures/domain.js';
import { spatialMatch } from '../src/simulation/spatial-match.js';
import { mulberry32 } from '../src/simulation/random.js';
import { type MatchInstructions, type PlayerSnapshot, lineupSchema } from '@football/shared';

function setup(instructions?: MatchInstructions, fitness = 90, rating = 6) {
  const home = Array.from({ length: 11 }, (_, i) =>
    playerInput({ id: `starter-${i}`, position: i === 0 ? 'GK' : 'CM', fitness }),
  );
  const bench = Array.from({ length: 8 }, (_, i) =>
    playerInput({ id: `reserve-${i}`, position: 'CM', fitness: 100 }),
  );
  const teams = { home, away: [] as PlayerSnapshot[] };
  const ratings = Object.fromEntries(home.map((p) => [p.id, rating]));
  const dismissed = new Set<string>();
  const styles = { home: 'balanced', away: 'balanced' } as const;
  const reshapes: string[] = [];
  const options: MatchOptions = {
    home: { bench, plan: { formation: '4-3-3', starters: home.map((p) => p.id), instructions } },
  };
  const manager = matchManagement(
    options,
    teams,
    styles,
    ratings,
    dismissed,
    () => {},
    (_, f) => reshapes.push(f),
  );
  return { manager, teams, bench, ratings, dismissed, styles, reshapes, options };
}
const instructions = (
  substitutions: MatchInstructions['substitutions'] = [],
): MatchInstructions => ({ substitutions, protected: [], situations: [] });
describe('gestão durante a partida', () => {
  it('goleiro acumula apenas 40% do desgaste da linha nas mesmas condições', () => {
    const { manager, teams } = setup(undefined, 100, 7);
    manager.update(90, 0, 0);
    const keeper = teams.home[0]!;
    const outfield = teams.home[1]!;
    expect(manager.fitnessSpent[keeper.id]).toBeCloseTo(manager.fitnessSpent[outfield.id]! * 0.4);
    expect(manager.fitness(keeper)).toBeGreaterThan(manager.fitness(outfield));
    expect(keeper.fitness).toBe(100);
  });
  it('prioriza reserva natural mesmo quando outro improvisado tem overall maior', () => {
    const { manager, bench } = setup(undefined, 20, 7);
    bench.splice(
      0,
      bench.length,
      playerInput({ id: 'natural', position: 'CM', overall: 70, fitness: 100 }),
      playerInput({ id: 'improvised', position: 'AM', overall: 90, fitness: 100 }),
    );
    manager.update(60, 0, 0);
    expect(manager.substitutions[0]?.in).toBe('natural');
  });
  it('entre atletas com cansaço parecido tira primeiro a pior nota, depois o menor overall', () => {
    const { manager, teams, bench, ratings } = setup(undefined, 20, 7);
    bench.splice(1);
    teams.home[1] = { ...teams.home[1]!, fitness: 22, overall: 90 };
    ratings['starter-1'] = 5;
    manager.update(60, 0, 0);
    expect(manager.substitutions[0]?.out).toBe('starter-1');
    const second = setup(undefined, 20, 7);
    second.bench.splice(1);
    second.teams.home[2] = { ...second.teams.home[2]!, overall: 60 };
    second.manager.update(60, 0, 0);
    expect(second.manager.substitutions[0]?.out).toBe('starter-2');
  });
  it('não tira um jogador sem reposição compatível e considera outro cansado', () => {
    const { manager, teams, bench, ratings } = setup(undefined, 90, 7);
    teams.home[1] = { ...teams.home[1]!, position: 'CB', fitness: 20 };
    teams.home[2] = { ...teams.home[2]!, position: 'ST', fitness: 22 };
    ratings['starter-1'] = 4;
    bench.splice(0, bench.length, playerInput({ id: 'midfielder', position: 'ST', fitness: 100 }));
    manager.update(60, 0, 0);
    expect(manager.substitutions).toEqual([
      expect.objectContaining({ out: 'starter-2', in: 'midfielder' }),
    ]);
  });
  it.each([0, 7, 15])('aplica adaptação de %i jogos ao reserva fora de posição', (matches) => {
    const { manager, teams, bench, options } = setup(
      instructions([{ out: 'starter-1', in: 'reserve-0', when: 60, score: 'always' }]),
    );
    bench[0] = { ...bench[0]!, position: 'AM', overall: 90 };
    options.home!.positionExperience = { 'reserve-0': { CM: matches } };
    manager.update(60, 0, 0);
    const incoming = teams.home.find((p) => p.id === 'reserve-0')!;
    expect(incoming.position).toBe('CM');
    expect(incoming.overall).toBe(Math.floor(90 * (0.97 + (0.03 * matches) / 15)));
    expect(bench[0]!.overall).toBe(90);
    expect(bench[0]!.position).toBe('AM');
  });
  it('evita trocar veterano ainda superior por um reserva muito inferior', () => {
    const { manager, teams, bench } = setup(undefined, 90, 7);
    teams.home[1] = { ...teams.home[1]!, age: 38, overall: 95 };
    bench.splice(
      0,
      bench.length,
      playerInput({ id: 'weak', position: 'CM', fitness: 100, overall: 40 }),
    );
    manager.update(85, 0, 0);
    expect(manager.substitutions).toEqual([]);
  });
  it('salva o desgaste real sem alterar os jogadores originais e repete a mesma simulação', () => {
    const { teams } = setup(undefined, 90, 7);
    const home = teams.home.map((p) => ({ ...p, age: 38 }));
    const away = teams.home.map((p, i) => ({ ...p, id: `away-${i}`, age: 20 }));
    const before = structuredClone({ home, away });
    const simulate = () =>
      spatialMatch(home, away, mulberry32(42), 0, undefined, {
        scenarioOnlyScheduledDismissals: true,
      });
    const result = simulate();
    expect(result.fitnessSpent[home[1]!.id]).toBeGreaterThan(result.fitnessSpent[away[1]!.id]!);
    expect(result.fitnessSpent[home[1]!.id]).toBeCloseTo(36 * 1.74);
    expect({ home, away }).toEqual(before);
    expect(simulate()).toEqual(result);
  });
  it('veteranos perdem mais condição e podem sair por cansaço mesmo com nota boa', () => {
    const { manager, teams } = setup(undefined, 90, 7);
    teams.home[1] = { ...teams.home[1]!, age: 38 };
    teams.home[2] = { ...teams.home[2]!, age: 20 };
    manager.update(0, 0, 0);
    manager.update(55, 0, 0);
    expect(manager.fitness(teams.home[1]!)).toBeLessThan(manager.fitness(teams.home[2]!));
    for (let minute = 60; minute <= 85; minute += 5) manager.update(minute, 0, 0);
    expect(manager.substitutions).toContainEqual(
      expect.objectContaining({ out: 'starter-1', reason: 'fatigue' }),
    );
    expect(manager.substitutions.some((s) => s.out === 'starter-2')).toBe(false);
  });
  it('acumula a intensidade por período sem recalcular retroativamente o desgaste', () => {
    const { manager, teams, styles } = setup(
      {
        protected: [],
        substitutions: [],
        situations: [{ trigger: 'losing-60', style: 'gegenpress' }],
      },
      100,
      7,
    );
    const p = teams.home[1]!;
    manager.update(60, 0, 1);
    const at60 = manager.fitness(p);
    expect(styles.home).toBe('gegenpress');
    manager.update(90, 0, 1);
    expect(at60).toBeCloseTo(100 - (36 * 0.8 * 60) / 90);
    expect(manager.fitness(p)).toBeCloseTo(at60 - (36 * 0.8 * 1.25 * 30) / 90);
    const loss = manager.fitnessSpent[p.id];
    manager.update(90, 0, 1);
    expect(manager.fitnessSpent[p.id]).toBe(loss);
    expect(p.fitness).toBe(100);
  });
  it('o reserva entra descansado e só acumula os minutos que joga', () => {
    const { manager, teams } = setup(
      instructions([{ out: 'starter-1', in: 'reserve-0', when: 60, score: 'always' }]),
      100,
      7,
    );
    manager.update(60, 0, 0);
    const reserve = teams.home.find((p) => p.id === 'reserve-0')!;
    const outgoingLoss = manager.fitnessSpent['starter-1'];
    expect(manager.fitness(reserve)).toBe(100);
    manager.update(90, 0, 0);
    expect(manager.fitness(reserve)).toBeCloseTo(100 - (36 * 0.8) / 3);
    expect(manager.fitnessSpent['starter-1']).toBe(outgoingLoss);
  });
  it('não executa uma troca planejada antiga para um jogador protegido', () => {
    const plan = instructions([{ out: 'starter-1', in: 'reserve-0', when: 60, score: 'always' }]);
    plan.protected = ['starter-1'];
    const { manager } = setup(plan);
    manager.update(60, 0, 0);
    manager.update(90, 0, 0);
    expect(manager.substitutions.some((swap) => swap.out === 'starter-1')).toBe(false);
  });
  it('o reserva participa dos lances reais sem devolver o titular ao campo', () => {
    const { teams, bench } = setup();
    const away = teams.home.map((p, i) => ({ ...p, id: `away-${i}` }));
    const config = {
      home: {
        bench,
        plan: {
          formation: '4-3-3' as const,
          starters: teams.home.map((p) => p.id),
          instructions: instructions([
            { out: 'starter-1', in: 'reserve-0', when: 60, score: 'always' },
          ]),
        },
      },
    };
    const result = spatialMatch(teams.home, away, mulberry32(42), 0, undefined, config);
    expect(result.substitutions).toContainEqual({
      side: 'home',
      minute: 60,
      out: 'starter-1',
      in: 'reserve-0',
      reason: 'planned',
    });
    expect(
      result.actions
        .filter((a) => a.minute >= 60)
        .some((a) => a.playerId === 'starter-1' || a.targetId === 'starter-1'),
    ).toBe(false);
    expect(
      result.actions.some((a) => a.playerId === 'reserve-0' || a.targetId === 'reserve-0'),
    ).toBe(true);
    expect(result.ratings['reserve-0']).toBeGreaterThanOrEqual(0);
    expect(result.minutesPlayed['starter-1']).toBe(60);
    expect(result.actions.every((a) => a.coordinates?.length === 44)).toBe(true);
    expect(spatialMatch(teams.home, away, mulberry32(42), 0, undefined, config)).toEqual(result);
  });
  it('não obriga cinco trocas com um time descansado e jogando bem', () => {
    const { manager } = setup();
    for (let minute = 0; minute <= 90; minute++) manager.update(minute, 0, 0);
    expect(manager.substitutions).toEqual([]);
  });
  it('executa os horários planejados, inclusive aos 90, com minutos proporcionais', () => {
    const { manager } = setup(
      instructions(
        [60, 80, 90].map((when, i) => ({
          out: `starter-${i + 1}`,
          in: `reserve-${i}`,
          when: when as 60 | 80 | 90,
          score: 'always',
        })),
      ),
    );
    for (let minute = 0; minute <= 90; minute++) manager.update(minute, 0, 0);
    expect(manager.substitutions.map((s) => s.minute)).toEqual([60, 80, 90]);
    expect(manager.finish()).toMatchObject({
      'starter-1': 60,
      'reserve-0': 30,
      'starter-3': 90,
      'reserve-2': 0,
    });
  });
  it('limita cinco trocas e reserva vagas para as planejadas', () => {
    const { manager } = setup(
      instructions([{ out: 'starter-1', in: 'reserve-0', when: 90, score: 'always' }]),
      20,
      5,
    );
    manager.update(60, 0, 0);
    expect(manager.substitutions).toHaveLength(4);
    manager.update(90, 0, 0);
    expect(manager.substitutions).toHaveLength(5);
    expect(manager.substitutions.at(-1)).toMatchObject({
      in: 'reserve-0',
      minute: 90,
      reason: 'planned',
    });
  });
  it('troca por cansaço só abaixo de 30 e a partir de 60 minutos', () => {
    const { manager } = setup(
      instructions([{ out: 'starter-1', in: 'reserve-0', when: 'fatigue', score: 'always' }]),
      35,
    );
    manager.update(30, 0, 0);
    expect(manager.substitutions).toHaveLength(0);
    manager.update(60, 0, 0);
    expect(manager.substitutions[0]).toMatchObject({
      out: 'starter-1',
      in: 'reserve-0',
      minute: 60,
    });
  });
  it('respeita placar, expulsões e proteção das trocas automáticas', () => {
    const plan = instructions([{ out: 'starter-1', in: 'reserve-0', when: 60, score: 'winning' }]);
    plan.protected = ['starter-2'];
    const { manager, dismissed } = setup(plan, 20, 5);
    dismissed.add('starter-3');
    manager.update(60, 0, 1);
    expect(
      manager.substitutions.some((s) => ['starter-1', 'starter-2', 'starter-3'].includes(s.out)),
    ).toBe(false);
    manager.update(70, 2, 1);
    expect(manager.substitutions.at(-1)?.out).toBe('starter-1');
    expect(new Set(manager.substitutions.map((s) => s.in)).size).toBe(manager.substitutions.length);
  });
  it('substitui por rendimento e não troca goleiro automaticamente', () => {
    const { manager } = setup(undefined, 90, 5.5);
    manager.update(60, 0, 0);
    expect(manager.substitutions.length).toBeGreaterThan(0);
    expect(
      manager.substitutions.every((s) => s.reason === 'performance' && s.out !== 'starter-0'),
    ).toBe(true);
  });
  it('aplica estilo e formação quando a situação do placar é atingida', () => {
    const plan = instructions();
    plan.situations = [
      { trigger: 'losing-60', style: 'wings', formation: '4-2-4' },
      { trigger: 'drawing-75', style: 'gegenpress' },
    ];
    const { manager, styles, reshapes } = setup(plan);
    manager.update(59, 0, 1);
    expect(styles.home).toBe('balanced');
    manager.update(60, 0, 1);
    expect(styles.home).toBe('wings');
    expect(reshapes).toEqual(['4-2-4']);
    manager.update(75, 1, 1);
    expect(styles.home).toBe('gegenpress');
    manager.update(80, 1, 0);
    expect(styles.home).toBe('balanced');
    expect(reshapes).toEqual(['4-2-4', '4-3-3']);
  });
  it('rejeita mais de três trocas e horários não oferecidos', () => {
    const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    const plan = {
      formation: '4-3-3',
      starters: Array.from({ length: 11 }, (_, i) => id(i)),
      instructions: instructions(
        Array.from({ length: 4 }, (_, i) => ({
          out: id(i),
          in: id(i + 20),
          when: 60,
          score: 'always',
        })),
      ),
    };
    expect(
      lineupSchema.safeParse({
        ...plan,
        instructions: instructions(plan.instructions.substitutions.slice(0, 3)),
      }).success,
    ).toBe(true);
    expect(lineupSchema.safeParse(plan).success).toBe(false);
    expect(
      lineupSchema.safeParse({
        ...plan,
        instructions: instructions([{ out: id(1), in: id(21), when: 75 as 60, score: 'always' }]),
      }).success,
    ).toBe(false);
  });
});
