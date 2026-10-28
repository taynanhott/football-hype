import { describe, expect, it } from 'vitest';
import {
  clubSchema,
  domainLimitsSchema,
  leagueSchema,
  normalizedSchema,
  playerSchema,
  stadiumSchema,
  trainingCenterSchema,
} from '../src/index.js';
import {
  clubInput,
  IDS,
  leagueInput,
  playerInput,
  stadiumInput,
  trainingCenterInput,
} from '../../../tests/fixtures/domain.js';

describe('contratos de fronteira', () => {
  it.each([
    { schema: playerSchema, input: playerInput() },
    { schema: clubSchema, input: clubInput() },
    { schema: leagueSchema, input: leagueInput() },
    { schema: stadiumSchema, input: stadiumInput() },
    { schema: trainingCenterSchema, input: trainingCenterInput() },
  ])('rejeita campos desconhecidos e aceita ida e volta em JSON', ({ schema, input }) => {
    expect(schema.safeParse({ ...input, injected: true }).success).toBe(false);
    expect(schema.safeParse(JSON.parse(JSON.stringify(input))).success).toBe(true);
    expect(schema.safeParse(null).success).toBe(false);
  });

  it('rejeita configuração com intervalos inconsistentes', () => {
    expect(domainLimitsSchema.safeParse({ age: { min: 100, max: 16 } }).success).toBe(false);
  });
});

describe('contrato normalizado', () => {
  const schema = normalizedSchema(playerSchema);
  const player = playerInput();

  it('aceita vazio e garante congelamento do contrato completo', () => {
    expect(schema.safeParse({ ids: [], byId: {} }).success).toBe(true);
    const parsed = schema.parse({ ids: [player.id], byId: { [player.id]: player } });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.ids)).toBe(true);
    expect(Object.isFrozen(parsed.byId)).toBe(true);
    expect(Object.isFrozen(parsed.byId[player.id])).toBe(true);
  });

  it.each([
    { ids: [player.id], byId: {} },
    { ids: [], byId: { [player.id]: player } },
    { ids: [player.id, player.id], byId: { [player.id]: player } },
    { ids: [IDS.secondPlayer], byId: { [IDS.secondPlayer]: player } },
    { ids: ['__proto__'], byId: {} },
  ])('rejeita índices inconsistentes %j', (input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});
