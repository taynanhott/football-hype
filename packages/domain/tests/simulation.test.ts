import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import {
  agePlayer,
  appearanceGrowth,
  ContextualInterest,
  EventBus,
  hashSeed,
  matchMachine,
  mulberry32,
  negotiationMachine,
  readyMachine,
  SearchTrie,
  seasonMachine,
  settleRoundFinance,
  simulateMatch,
} from '../src/index.js';
import {
  clubInput,
  IDS,
  playerInput,
  stadiumInput,
  trainingCenterInput,
} from '../../../tests/fixtures/domain.js';

describe('simulação determinística', () => {
  it('a mesma seed reproduz a sequência e o resultado', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const left = mulberry32(seed);
        const right = mulberry32(seed);
        expect(Array.from({ length: 100 }, left)).toEqual(Array.from({ length: 100 }, right));
        const value = left();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }),
    );
    expect(hashSeed(1, 'a')).not.toBe(hashSeed(1, 'b'));
    const fixture = {
      id: 'one',
      competitionId: 'serie-a',
      round: 0,
      homeId: IDS.club,
      awayId: IDS.secondClub,
      scheduledAt: 0,
    };
    const home = Array.from({ length: 11 }, () => playerInput());
    const away = Array.from({ length: 11 }, () => playerInput({ clubId: IDS.secondClub }));
    const result = simulateMatch(fixture, home, away, stadiumInput(), 123);
    expect(simulateMatch(fixture, home, away, stadiumInput(), 123)).toEqual(result);
    expect(result.scorers).toHaveLength(result.homeGoals + result.awayGoals);
    expect(result.scorers.every((scorer) => scorer.minute >= 1 && scorer.minute <= 90)).toBe(true);
    expect(simulateMatch(fixture, [], [], stadiumInput(), 1).attendance).toBeGreaterThan(0);
    expect(
      simulateMatch(
        fixture,
        home,
        away,
        {
          ...stadiumInput(),
          sectors: stadiumInput().sectors.map((sector) => ({
            ...sector,
            capacity: sector.capacity * 2,
          })),
        },
        123,
      ).revenue,
    ).toBeGreaterThan(result.revenue);
  });
  it('evolui apenas jovens que jogam e nunca excede o potencial', () => {
    const young = playerInput({ age: 20, overall: 80, potential: 81 });
    const result = appearanceGrowth(young, 5, 0.9);
    expect(result.player.overall).toBe(81);
    expect(result.progress).toBeLessThan(1);
    expect(appearanceGrowth(playerInput({ age: 30 }), 5, 0).player.overall).toBe(72);
    expect(appearanceGrowth(playerInput({ overall: 88, potential: 88 }), 5, 0).player.overall).toBe(
      88,
    );
    expect(appearanceGrowth(young, 5, 0).progress).toBeGreaterThan(
      appearanceGrowth(young, 1, 0).progress,
    );
    expect(agePlayer(playerInput({ age: 31, position: 'ST' })).overall).toBe(71);
    expect(agePlayer(playerInput({ age: 31, position: 'GK' })).overall).toBe(72);
    expect(agePlayer(playerInput({ age: 36, position: 'GK' })).overall).toBe(71);
  });
  it('considera divisão, estrutura e idade no interesse', () => {
    const strategy = new ContextualInterest();
    const buyer = clubInput({ division: 'C' });
    const seller = clubInput({ division: 'A' });
    const center = trainingCenterInput();
    const young = strategy.calculate(playerInput({ age: 20 }), buyer, seller, center, 65);
    const older = strategy.calculate(playerInput({ age: 34 }), buyer, seller, center, 65);
    expect(older).toBeGreaterThan(young);
    expect(strategy.calculate(playerInput(), clubInput(), undefined, center, 80)).toBeGreaterThan(
      young,
    );
    expect(
      strategy.calculate(
        playerInput(),
        buyer,
        seller,
        { ...center, levels: { ...center.levels, scouting: 5 } },
        65,
      ),
    ).toBeGreaterThan(young);
  });
  it('desconta salários, recebe patrocínio e carrega dívidas', () => {
    const result = settleRoundFinance(
      clubInput({ balance: { cents: 0, currency: 'BRL' } }),
      [playerInput({ salary: { cents: 400000000, currency: 'BRL' } })],
      0,
      1,
      0,
    );
    expect(result.club.balance.cents).toBe(0);
    expect(result.debt).toBeGreaterThan(0);
    expect(settleRoundFinance(clubInput(), [], 100, 5, 1).club.balance.cents).toBeGreaterThan(
      clubInput().balance.cents,
    );
  });
  it('atletas de uma liga internacional mais forte têm menos interesse no mesmo comprador', () => {
    const strategy = new ContextualInterest();
    const player = playerInput();
    const buyer = clubInput({ leagueStrength: 80 });
    const center = trainingCenterInput();
    const domestic = clubInput({ leagueStrength: 80, country: 'BR', division: 'A' });
    const foreign = clubInput({ leagueStrength: 95, country: 'GB', division: 'REGIONAL' });
    expect(strategy.calculate(player, buyer, foreign, center, 75)).toBeLessThan(
      strategy.calculate(player, buyer, domestic, center, 75),
    );
  });
});
describe('estados, observadores e busca', () => {
  it('só percorre transições válidas de partida, negociação, temporada e pronto', () => {
    const match = createActor(matchMachine).start();
    match.send({ type: 'FINISH' });
    expect(match.getSnapshot().value).toBe('scheduled');
    for (const type of ['KICKOFF', 'HALFTIME', 'RESUME', 'FINISH'] as const) match.send({ type });
    expect(match.getSnapshot().status).toBe('done');
    match.stop();
    const negotiation = createActor(negotiationMachine).start();
    negotiation.send({ type: 'ACCEPT_SALARY' });
    expect(negotiation.getSnapshot().value).toBe('fee');
    negotiation.send({ type: 'ACCEPT_FEE' });
    negotiation.send({ type: 'ACCEPT_SALARY' });
    expect(negotiation.getSnapshot().value).toBe('completed');
    negotiation.stop();
    const rejected = createActor(negotiationMachine).start();
    rejected.send({ type: 'REJECT' });
    expect(rejected.getSnapshot().value).toBe('rejected');
    rejected.stop();
    const season = createActor(seasonMachine).start();
    season.send({ type: 'START' });
    season.send({ type: 'FINISH' });
    season.send({ type: 'NEW_SEASON' });
    expect(season.getSnapshot().value).toBe('active');
    season.stop();
    const ready = createActor(readyMachine).start();
    ready.send({ type: 'READY' });
    ready.send({ type: 'CANCEL' });
    expect(ready.getSnapshot().value).toBe('waiting');
    ready.send({ type: 'READY' });
    ready.send({ type: 'ROUND' });
    expect(ready.getSnapshot().value).toBe('waiting');
    ready.stop();
  });
  it('notifica observadores e remove inscrições', () => {
    const bus = new EventBus<number>();
    const received: number[] = [];
    const stop = bus.subscribe((value) => received.push(value));
    bus.emit(1);
    stop();
    bus.emit(2);
    expect(received).toEqual([1]);
  });
  it('a trie pesquisa prefixos com acentos e ignora caixa', () => {
    const trie = new SearchTrie();
    trie.insert('João Caio', '1');
    trie.insert('João Pedro', '2');
    expect(trie.search('JOA')).toEqual(['1', '2']);
    expect(trie.search('João C')).toEqual(['1']);
    expect(trie.search('x')).toEqual([]);
    expect(trie.search('')).toEqual(['1', '2']);
  });
});
