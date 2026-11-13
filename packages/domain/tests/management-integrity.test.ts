import { beforeEach, describe, expect, it } from 'vitest';
import { type WorldState } from '@football/shared';
import {
  createWorld,
  stableId,
  executeCommand,
  applyEvent,
  contractTerminationCost,
  upgradePrice,
} from '../src/index.js';
import { unwrap, withTransferReserves } from '../../../tests/fixtures/domain.js';
const now = Date.parse('2026-01-15T15:00:00Z');
let state: WorldState;
beforeEach(() => {
  state = withTransferReserves(
    unwrap(
      createWorld({
        id: stableId(981, 1),
        name: 'Integridade',
        mode: 'offline',
        userId: 'host',
        now,
      }),
    ),
  );
});
const own = () => state.clubs.byId[state.participants[0]!.clubId]!;
const run = (command: Parameters<typeof executeCommand>[1]) =>
  executeCommand(state, command, 'host', now, stableId(982, state.revision + 1));
const act = (command: Parameters<typeof executeCommand>[1]) =>
  unwrap(applyEvent(state, unwrap(run(command))));

describe('operações persistidas de gestão', () => {
  it('revisa e retira a própria proposta sem contar a reserva duas vezes', () => {
    const buyer = own(),
      seller = state.clubs.byId[state.clubs.ids.find((id) => id !== buyer.id)!]!;
    const player = state.players.byId[seller.playerIds.at(-1)!]!;
    state.participants = [
      ...state.participants,
      { ...state.participants[0]!, userId: 'seller', clubId: seller.id },
    ];
    state.management = {
      ...state.management,
      policies: { [player.id]: { available: true, rivals: true, interest: 100 } },
      financialPlans: { [buyer.id]: { transfer: 1000000, salaries: 0 } },
    };
    state.negotiations = [
      {
        id: stableId(983, 1),
        buyerId: buyer.id,
        sellerId: seller.id,
        playerId: player.id,
        fee: 1000000,
        offeredSalary: null,
        interest: 100,
        status: 'review',
        expiresAt: now + 86400000,
      },
    ];
    state = act({ type: 'offer', playerId: player.id, fee: 1000000 });
    expect(state.negotiations.filter((n) => n.status === 'review')).toHaveLength(1);
    state = act({ type: 'offer', playerId: player.id, fee: 0, withdraw: true });
    expect(state.negotiations.find((n) => n.withdrawn)?.status).toBe('rejected');
    expect(run({ type: 'offer', playerId: player.id, fee: 0, withdraw: true }).ok).toBe(false);
  });
  it('contraoferta humana exige valor superior e prazo válido', () => {
    const seller = own(),
      player = state.players.byId[seller.playerIds.at(-1)!]!;
    const offerId = stableId(983, 2);
    state.negotiations = [
      {
        id: offerId,
        sellerId: seller.id,
        buyerId: state.clubs.ids.find((id) => id !== seller.id)!,
        playerId: player.id,
        fee: 1000000,
        offeredSalary: null,
        interest: 100,
        status: 'review',
        expiresAt: now + 86400000,
      },
    ];
    expect(run({ type: 'management', action: 'counter-offer', offerId, fee: 1000000 }).ok).toBe(
      false,
    );
    const next = act({ type: 'management', action: 'counter-offer', offerId, fee: 1500000 });
    expect(next.negotiations[0]).toMatchObject({ fee: 1500000, status: 'salary' });
    state.negotiations = state.negotiations.map((n) => ({
      ...n,
      expiresAt: state.lastProcessedAt,
    }));
    expect(run({ type: 'management', action: 'counter-offer', offerId, fee: 1500000 }).ok).toBe(
      false,
    );
  });
  it('rescisão paga uma única indenização e limpa os vínculos do reserva', () => {
    const club = own(),
      player = state.players.byId[club.playerIds.at(-1)!]!;
    const starters = club.playerIds.slice(0, 11);
    state.tactics[club.id] = {
      formation: '4-4-2',
      starters,
      bench: [player.id],
      instructions: {
        substitutions: [{ out: starters[0]!, in: player.id, when: 60, score: 'always' }],
        protected: [player.id],
        situations: [],
      },
    };
    state.management = {
      ...state.management,
      contracts: { ...state.management?.contracts, [player.id]: now + 365 * 86400000 },
      policies: {
        ...state.management?.policies,
        [player.id]: {
          available: true,
          loanAvailable: false,
          loanMonths: 6,
          rivals: true,
          interest: 75,
        },
      },
    };
    const cost = contractTerminationCost(state, player);
    const next = act({ type: 'management', action: 'terminate-contract', playerId: player.id });
    expect(next.clubs.byId[club.id]!.balance.cents).toBe(club.balance.cents - cost);
    expect(next.clubs.byId[club.id]!.playerIds).not.toContain(player.id);
    expect(next.players.byId[player.id]!.clubId).toBeNull();
    expect(next.management?.contracts?.[player.id]).toBeUndefined();
    expect(next.management?.policies?.[player.id]).toBeUndefined();
    expect(next.tactics[club.id]).toMatchObject({
      bench: [],
      instructions: { substitutions: [], protected: [] },
    });
    state = next;
    expect(run({ type: 'management', action: 'terminate-contract', playerId: player.id }).ok).toBe(
      false,
    );
  });
  it('rescisão de titular invalida a escalação para resolução automática', () => {
    const club = own(),
      player = state.players.byId[club.playerIds[0]!]!;
    state.tactics[club.id] = {
      formation: '4-4-2',
      starters: club.playerIds.slice(0, 11),
      bench: [],
    };
    const next = act({ type: 'management', action: 'terminate-contract', playerId: player.id });
    expect(next.tactics[club.id]).toBeUndefined();
  });
  it('impede rescisão sem caixa, sem propriedade e abaixo do elenco mínimo', () => {
    const club = own(),
      playerId = club.playerIds[0]!;
    expect(
      run({
        type: 'management',
        action: 'terminate-contract',
        playerId: state.clubs.byId[state.clubs.ids.find((id) => id !== club.id)!]!.playerIds[0]!,
      }).ok,
    ).toBe(false);
    state.clubs = {
      ...state.clubs,
      byId: { ...state.clubs.byId, [club.id]: { ...club, balance: { ...club.balance, cents: 0 } } },
    };
    expect(run({ type: 'management', action: 'terminate-contract', playerId }).ok).toBe(false);
    state.clubs = {
      ...state.clubs,
      byId: { ...state.clubs.byId, [club.id]: { ...club, playerIds: club.playerIds.slice(0, 18) } },
    };
    expect(run({ type: 'management', action: 'terminate-contract', playerId }).ok).toBe(false);
  });
  it.each([
    'structure',
    'pitch',
    'surroundings',
    'shirts',
    'food',
    'hospitality',
    'fitness',
    'medical',
    'scouting',
    'coaching',
    'marketing',
  ])('venda do departamento %s reduz um nível e devolve metade do investimento', (target) => {
    const club = own(),
      stadium = state.stadiums.byId[club.stadiumId]!,
      center = state.centers.byId[club.trainingCenterId]!;
    state.stadiums = {
      ...state.stadiums,
      byId: {
        ...state.stadiums.byId,
        [stadium.id]: {
          ...stadium,
          sectors: stadium.sectors.map((s) => ({ ...s, level: 3 })),
          pitchLevel: 3,
          surroundingsLevel: 3,
          commerce: { ...stadium.commerce, shirtsLevel: 3, foodLevel: 3, hospitalityLevel: 3 },
        },
      },
    };
    state.centers = {
      ...state.centers,
      byId: {
        ...state.centers.byId,
        [center.id]: {
          ...center,
          levels: {
            ...center.levels,
            fitness: 3,
            medical: 3,
            scouting: 3,
            coaching: 3,
            marketing: 3,
          },
          operations: undefined,
        },
      },
    };
    const next = act({ type: 'management', action: 'sell-facility', target });
    expect(next.clubs.byId[club.id]!.balance.cents - club.balance.cents).toBe(
      upgradePrice(2, target) / 2,
    );
    expect(next.players).toEqual(state.players);
  });
  it('personalização persiste sem mexer no caixa e protege skins bloqueadas', () => {
    const club = own(),
      stadium = state.stadiums.byId[club.stadiumId]!;
    const command = {
      type: 'customize' as const,
      primary: '#123456',
      secondary: '#abcdef',
      pattern: 'stripes' as const,
      stadiumColor: '#223344',
      centerColor: '#445566',
    };
    const next = act(command);
    expect(next.clubs.byId[club.id]!.kit).toEqual({
      primary: '#123456',
      secondary: '#abcdef',
      pattern: 'stripes',
    });
    expect(next.stadiums.byId[stadium.id]!.color).toBe('#223344');
    expect(next.centers.byId[club.trainingCenterId]!.color).toBe('#445566');
    expect(next.clubs.byId[club.id]!.balance).toEqual(club.balance);
    expect(run({ ...command, stadiumSkin: 'maracana' }).ok).toBe(false);
    state.stadiums = {
      ...state.stadiums,
      byId: {
        ...state.stadiums.byId,
        [stadium.id]: { ...stadium, sectors: stadium.sectors.map((s) => ({ ...s, level: 4 })) },
      },
    };
    const skinned = act({ ...command, stadiumSkin: 'maracana' });
    expect(skinned.stadiums.byId[stadium.id]!.skin).toBe('maracana');
    state = skinned;
    expect(act({ ...command, stadiumSkin: null }).stadiums.byId[stadium.id]!.skin).toBeUndefined();
  });
});
