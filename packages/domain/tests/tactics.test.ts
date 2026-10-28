import { describe, expect, it } from 'vitest';
import {
  FORMATIONS,
  formationSchema,
  positionSchema,
  commandSchema,
  worldStateSchema,
  matchResultSchema,
  type WorldState,
} from '@football/shared';
import { createWorld, stableId } from '../src/game/world-factory.js';
import {
  initializeStartingChemistry,
  tacticalAdaptation,
  chemistryPercent,
  injuryProbability,
  positionFactor,
  resolveLineup,
  resolveBench,
} from '../src/game/tactics.js';
import { executeCommand } from '../src/game/commands.js';
import { playNextBatch } from '../src/game/play-batch.js';
import { temporaryModifiers } from '../src/game/management.js';

const now = Date.parse('2026-10-26T15:00:00Z');
function fixture() {
  const result = createWorld({
    id: stableId(90, 5),
    userId: 'tactics-test',
    name: 'Tática',
    mode: 'offline',
    now,
  });
  if (!result.ok) throw new Error(result.error.message);
  const state: WorldState = { ...result.value, chemistry: {} };
  const club = state.clubs.byId[state.participants[0]?.clubId ?? ''];
  if (!club) throw new Error('Clube ausente');
  return { state, club };
}
describe('escalação, entrosamento e carga', () => {
  it('adapta formação e estilo em três jogos e conserva combinações dominadas após seis', () => {
    const { state: initial, club } = fixture();
    const base = initializeStartingChemistry(initial);
    const game = base.fixtures.find((row) => row.homeId === club.id || row.awayId === club.id)!;
    const side = game.homeId === club.id ? 'home' : 'away';
    const plan = { formation: '4-4-2', style: 'wings', starters: [], bench: [] } as const;
    const result = (id: string, alternate = false) =>
      matchResultSchema.parse({
        fixtureId: id,
        homeGoals: 0,
        awayGoals: 0,
        attendance: 0,
        revenue: 0,
        seed: 1,
        scorers: [],
        tacticalPlans: {
          home: plan,
          away: plan,
          [side]: alternate ? { ...plan, formation: '5-3-2', style: 'counter' } : plan,
        },
      });
    const history = (count: number, switched = false): WorldState => {
      const fixtures = Array.from({ length: count + Number(switched) }, (_, i) => ({
        ...game,
        id: 'adaptation-' + i,
        scheduledAt: now + i,
      }));
      return {
        ...base,
        fixtures,
        results: fixtures.map((f, i) => result(f.id, switched && i === count)),
      };
    };
    expect(tacticalAdaptation(history(0), club.id, '4-4-2', 'wings')).toMatchObject({
      formation: 0,
      style: 0,
      mastered: false,
    });
    expect(tacticalAdaptation(history(2), club.id, '4-4-2', 'wings').formation).toBeCloseTo(
      200 / 3,
    );
    expect(tacticalAdaptation(history(3), club.id, '4-4-2', 'wings')).toMatchObject({
      formation: 100,
      style: 100,
      mastered: false,
    });
    expect(tacticalAdaptation(history(3, true), club.id, '4-4-2', 'wings')).toMatchObject({
      formation: 0,
      style: 0,
    });
    const mastered = history(6, true);
    expect(tacticalAdaptation(mastered, club.id, '4-4-2', 'wings')).toMatchObject({
      formation: 100,
      style: 100,
      mastered: true,
    });
    const lineup = resolveLineup(mastered, club, now, mastered.players.byId, '4-4-2', [], 'wings');
    const player = lineup.find((slot) => slot.player)?.player;
    expect(player).toBeDefined();
    const changed = {
      ...mastered,
      chemistry: {
        ...mastered.chemistry,
        [club.id]: { ...mastered.chemistry[club.id], [player!.id]: 0 },
      },
    };
    expect(
      resolveLineup(changed, club, now, changed.players.byId, '4-4-2', [], 'wings').find(
        (slot) => slot.player?.id === player!.id,
      )?.chemistry,
    ).toBe(0);
    const archived: WorldState = {
      ...base,
      results: [],
      fixtures: [],
      seasonArchives: [
        {
          season: base.season,
          clubs: base.clubs,
          fixtures: mastered.fixtures,
          results: mastered.results,
          cups: [],
        },
      ],
    };
    expect(tacticalAdaptation(archived, club.id, '4-4-2', 'wings').mastered).toBe(true);
  });

  it('inicia os titulares originais com entrosamento completo e reservas sem bônus', () => {
    const { state: initial, club } = fixture();
    const state = initializeStartingChemistry(initial);
    const starters = resolveLineup(state, club, state.createdAt);
    expect(starters).toHaveLength(11);
    expect(starters.every((slot) => slot.player && slot.chemistry === 100)).toBe(true);
    const starterIds = new Set(starters.map((slot) => slot.player?.id));
    for (const id of club.playerIds.filter((id) => !starterIds.has(id))) {
      expect(state.chemistry[club.id]?.[id] ?? 0).toBe(0);
    }
  });
  it('aplica má fase individual somente com média abaixo de seis e separa a fase do time', () => {
    const { state, club } = fixture();
    const player = state.players.byId[club.playerIds[0]!]!;
    const effectsFor = (notes: number[]) =>
      temporaryModifiers(
        {
          ...state,
          ratingHistory: notes.map((rating, index) => ({
            fixtureId: `rating-${index}`,
            season: state.season,
            playerId: player.id,
            rating,
          })),
        },
        player,
      );
    expect(effectsFor([]).some((effect) => effect.label === 'Má fase do jogador')).toBe(false);
    expect(effectsFor([5, 6]).find((effect) => effect.label === 'Má fase do jogador')?.value).toBe(
      -1,
    );
    expect(effectsFor([5, 7]).some((effect) => effect.label === 'Má fase do jogador')).toBe(false);
    expect(effectsFor([8]).some((effect) => effect.label === 'Má fase do jogador')).toBe(false);
    expect(effectsFor([]).some((effect) => effect.label === 'Boa fase do jogador')).toBe(false);
    expect(effectsFor([6, 8]).some((effect) => effect.label === 'Boa fase do jogador')).toBe(false);
    expect(
      effectsFor([7, 7.2]).find((effect) => effect.label === 'Boa fase do jogador')?.value,
    ).toBe(1);
    expect(effectsFor([5, 6]).some((effect) => effect.label === 'Boa fase do jogador')).toBe(false);
    const played = playNextBatch(state, now);
    if (!played.ok) throw new Error(played.error.message);
    const match = played.value.results.find(
      (result) => result.homeId === club.id || result.awayId === club.id,
    )!;
    expect(match).toBeDefined();
    const defeat = {
      ...match,
      homeGoals: match.homeId === club.id ? 0 : 1,
      awayGoals: match.awayId === club.id ? 0 : 1,
    };
    const effects = temporaryModifiers(
      {
        ...state,
        results: [defeat],
        ratingHistory: [
          { fixtureId: match.fixtureId, season: state.season, playerId: player.id, rating: 8 },
        ],
      },
      player,
    );
    expect(effects.some((effect) => effect.label === 'Má fase do time')).toBe(true);
    expect(effects.some((effect) => effect.label === 'Má fase do jogador')).toBe(false);
  });
  it('define um banco padrão sem titulares ou indisponíveis e respeita as trocas salvas', () => {
    const { state, club } = fixture();
    const starters = resolveLineup(state, club, now).flatMap((entry) =>
      entry.player ? [entry.player.id] : [],
    );
    const bench = resolveBench(state, club, now, starters);
    expect(bench.length).toBeGreaterThan(0);
    expect(bench.length).toBeLessThanOrEqual(12);
    expect(new Set(bench).size).toBe(bench.length);
    expect(bench.some((id) => starters.includes(id))).toBe(false);
    const injured = bench[0]!;
    expect(
      resolveBench({ ...state, injuries: { [injured]: 1 } }, club, now, starters),
    ).not.toContain(injured);
    const preferred = bench.slice(0, 3).reverse();
    expect(resolveBench(state, club, now, starters, preferred)).toEqual(preferred);
    expect(resolveBench(state, club, now, starters, [starters[0]!, ...preferred])).toEqual(
      preferred,
    );
  });
  it('persiste até três presets por clube e permite renomear, atualizar e excluir sem mudar o time ativo', () => {
    const { state: initial, club } = fixture();
    let state = initial;
    const starters = resolveLineup(state, club, now).flatMap((entry) =>
      entry.player ? [entry.player.id] : [],
    );
    const lineup = {
      formation: '4-3-3' as const,
      style: 'balanced' as const,
      starters,
      bench: club.playerIds.filter((id) => !starters.includes(id)).slice(0, 3),
    };
    const firstId = stableId(100, 1);
    for (let i = 1; i <= 3; i++) {
      const result = executeCommand(
        state,
        {
          type: 'lineup-preset',
          action: 'create',
          id: stableId(100, i),
          name: `Plano ${i}`,
          lineup,
        },
        'tactics-test',
        now,
        stableId(101, i),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error.message);
      state = worldStateSchema.parse({ ...state, ...result.value.patch });
    }
    expect(state.lineupPresets[club.id]).toHaveLength(3);
    expect(state.tactics).toEqual(initial.tactics);
    expect(
      executeCommand(
        state,
        { type: 'lineup-preset', action: 'create', id: stableId(100, 4), name: 'Quarto', lineup },
        'tactics-test',
        now,
        stableId(101, 4),
      ).ok,
    ).toBe(false);
    const renamed = executeCommand(
      state,
      { type: 'lineup-preset', action: 'rename', id: firstId, name: 'Time principal' },
      'tactics-test',
      now,
      stableId(101, 5),
    );
    if (!renamed.ok) throw new Error(renamed.error.message);
    state = worldStateSchema.parse({ ...state, ...renamed.value.patch });
    expect(state.lineupPresets[club.id]?.[0]?.name).toBe('Time principal');
    expect(state.lineupPresets[club.id]?.[0]?.lineup).toEqual(lineup);
    const updatedLineup = {
      ...lineup,
      formation: '4-4-2' as const,
      style: 'counter' as const,
      starters: [...starters].reverse(),
      bench: [],
    };
    const updated = executeCommand(
      state,
      { type: 'lineup-preset', action: 'update', id: firstId, lineup: updatedLineup },
      'tactics-test',
      now,
      stableId(101, 6),
    );
    if (!updated.ok) throw new Error(updated.error.message);
    state = worldStateSchema.parse({ ...state, ...updated.value.patch });
    expect(state.lineupPresets[club.id]?.[0]?.lineup).toEqual(updatedLineup);
    const removed = executeCommand(
      state,
      { type: 'lineup-preset', action: 'delete', id: firstId },
      'tactics-test',
      now,
      stableId(101, 7),
    );
    if (!removed.ok) throw new Error(removed.error.message);
    expect(removed.value.patch.lineupPresets?.[club.id]).toHaveLength(2);
    expect(
      commandSchema.safeParse({ type: 'lineup-preset', action: 'rename', id: firstId, name: ' ' })
        .success,
    ).toBe(false);
    const foreign = state.clubs.ids.find((id) => id !== club.id)!;
    const invalid = executeCommand(
      initial,
      {
        type: 'lineup-preset',
        action: 'create',
        id: firstId,
        name: 'Inválido',
        lineup: {
          ...lineup,
          starters: [state.clubs.byId[foreign]!.playerIds[0]!, ...starters.slice(1)],
        },
      },
      'tactics-test',
      now,
      stableId(101, 8),
    );
    expect(invalid.ok).toBe(false);
  });
  it('salva reservas e rejeita titulares, lesionados e atletas repetidos no banco', () => {
    const { state, club } = fixture();
    const starters = resolveLineup(state, club, now).flatMap((entry) =>
      entry.player ? [entry.player.id] : [],
    );
    const bench = club.playerIds.filter((id) => !starters.includes(id)).slice(0, 3);
    expect(bench.length).toBeGreaterThan(0);
    const command = { type: 'lineup' as const, formation: '4-3-3' as const, starters, bench };
    const result = executeCommand(state, command, 'tactics-test', now, stableId(92, 5));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.patch.tactics?.[club.id]?.bench).toEqual(bench);
    expect(
      executeCommand(
        state,
        { ...command, bench: [starters[0]!] },
        'tactics-test',
        now,
        stableId(93, 5),
      ).ok,
    ).toBe(false);
    expect(
      executeCommand(
        { ...state, injuries: { [bench[0]!]: 1 } },
        command,
        'tactics-test',
        now,
        stableId(94, 5),
      ).ok,
    ).toBe(false);
    expect(commandSchema.safeParse({ ...command, bench: [bench[0], bench[0]] }).success).toBe(
      false,
    );
    expect(
      commandSchema.safeParse({
        ...command,
        bench: Array.from({ length: 13 }, (_, i) => stableId(95, i)),
      }).success,
    ).toBe(false);
  });
  it('as dez formações têm onze posições, goleiro e atletas únicos', () => {
    const { state, club } = fixture();
    for (const formation of formationSchema.options) {
      expect(FORMATIONS[formation]).toHaveLength(11);
      expect(FORMATIONS[formation][0]?.position).toBe('GK');
      const entries = resolveLineup(state, club, now, state.players.byId, formation);
      expect(new Set(entries.map((entry) => entry.player?.id)).size).toBe(11);
      expect(entries.every((entry) => entry.chemistry === 0)).toBe(true);
    }
    for (const natural of positionSchema.options)
      for (const assigned of positionSchema.options)
        expect(positionFactor(natural, assigned)).toEqual(
          natural === assigned ? 1 : expect.any(Number),
        );
    expect(positionFactor('GK', 'ST')).toBeLessThan(positionFactor('CM', 'ST'));
    expect(positionFactor('CM', 'AM')).toBeGreaterThan(positionFactor('CB', 'ST'));
  });
  it('chega a 100% somente aos cinco jogos e o risco cresce com cansaço, sequência e pouco descanso', () => {
    expect([-1, 0, 1, 2, 3, 4, 5, 8].map(chemistryPercent)).toEqual([
      0, 0, 20, 40, 60, 80, 100, 100,
    ]);
    const rested = injuryProbability(100, 1, 168, 1);
    expect(injuryProbability(20, 1, 168, 1)).toBeGreaterThan(rested);
    expect(injuryProbability(100, 8, 168, 1)).toBeGreaterThan(rested);
    expect(injuryProbability(100, 1, 24, 1)).toBeGreaterThan(rested);
    expect(injuryProbability(20, 8, 24, 5)).toBeLessThan(injuryProbability(20, 8, 24, 1));
    expect(injuryProbability(-100, 100, 0, 0)).toBeLessThanOrEqual(0.5);
  });
  it('salva só atletas do próprio clube, sem duplicados ou lesionados', () => {
    const { state, club } = fixture();
    const starters = resolveLineup(state, club, now).flatMap((entry) =>
      entry.player ? [entry.player.id] : [],
    );
    const command = { type: 'lineup' as const, formation: '4-4-2' as const, starters };
    const run = (current: WorldState, ids = starters) =>
      executeCommand(current, { ...command, starters: ids }, 'tactics-test', now, stableId(91, 5));
    const result = run(state);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.type).toBe('lineup.changed');
    expect(result.value.patch.tactics?.[club.id]?.formation).toBe('4-4-2');
    expect(run(state, [...starters.slice(1), starters[1] ?? '']).ok).toBe(false);
    expect(run(state, starters.slice(1)).ok).toBe(false);
    expect(run({ ...state, injuries: { [starters[0] ?? '']: 1 } }).ok).toBe(false);
    expect(run(state, [stableId(2, 1000), ...starters.slice(1)]).ok).toBe(false);
    expect(commandSchema.safeParse({ ...command, formation: '8-1-1' }).success).toBe(false);
  });
  it('penaliza posição sem alterar o overall original e substitui indisponíveis', () => {
    const { state, club } = fixture();
    const entries = resolveLineup(state, club, now);
    const ids = entries.flatMap((entry) => (entry.player ? [entry.player.id] : []));
    const first = ids[0] ?? '',
      last = ids[10] ?? '';
    const swapped = [last, ...ids.slice(1, 10), first];
    const next = {
      ...state,
      tactics: { [club.id]: { formation: '4-3-3' as const, starters: swapped } },
      chemistry: { [club.id]: { [first]: 5 } },
    };
    expect(resolveLineup(next, club, now)[0]?.factor).toBeLessThan(1);
    expect(resolveLineup(next, club, now)[10]?.chemistry).toBe(100);
    expect(
      resolveLineup({ ...next, injuries: { [first]: 1 } }, club, now).some(
        (entry) => entry.player?.id === first,
      ),
    ).toBe(false);
    expect(resolveLineup(state, club, now, {}).every((entry) => !entry.player)).toBe(true);
    expect(
      resolveLineup(state, club, Date.parse('2026-11-12T15:00:00Z')).every(
        (entry) => (entry.player?.overall ?? 0) < 80,
      ),
    ).toBe(true);
  });
  it('conta só aparições no clube e dá repouso e recuperação a quem fica fora', () => {
    const { state: base, club } = fixture();
    const opponent = base.clubs.ids.find((id) => id !== club.id) ?? '';
    let state = {
      ...base,
      cups: [],
      fixtures: Array.from({ length: 6 }, (_, index) => ({
        id: `tactics-${index}`,
        competitionId: 'serie-a',
        round: index,
        homeId: club.id,
        awayId: opponent,
        scheduledAt: now + (index + 1) * 86400000,
      })),
      results: [],
    } as WorldState;
    const starters = resolveLineup(state, club, state.nextScheduledAt).flatMap((entry) =>
      entry.player ? [entry.player.id] : [],
    );
    const bench = club.playerIds.filter((playerId) => !starters.includes(playerId)).slice(0, 3);
    state = { ...state, tactics: { [club.id]: { formation: '4-3-3', starters, bench } } };
    const id = starters[0] ?? '';
    const overall = state.players.byId[id]?.overall;
    for (let count = 0; count < 5; count++) {
      const result = playNextBatch({ ...state, injuries: {} }, now);
      if (!result.ok) throw new Error(result.error.message);
      state = result.value;
      if (count === 0) expect(state.results.at(-1)?.tacticalPlans?.home.bench).toEqual(bench);
      expect(chemistryPercent(state.chemistry[club.id]?.[id] ?? 0)).toBe((count + 1) * 20);
    }
    expect(state.players.byId[id]?.overall).toBeGreaterThanOrEqual(overall ?? 0);
    expect(state.players.byId[id]?.overall).toBeLessThanOrEqual(
      state.players.byId[id]?.potential ?? 99,
    );
    expect(state.workload[id]?.consecutiveMatches).toBe(5);
    const rested = playNextBatch({ ...state, injuries: { [id]: 1 } }, now);
    if (!rested.ok) throw new Error(rested.error.message);
    expect(rested.value.workload[id]?.consecutiveMatches).toBe(0);
    expect(rested.value.injuries[id]).toBe(0);
    expect(rested.value.chemistry[club.id]?.[id]).toBe(5);
  });
});
