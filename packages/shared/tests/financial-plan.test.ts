import { describe, expect, it } from 'vitest';
import { commandSchema } from '../src/schemas/game.js';

describe('precisão do orçamento financeiro', () => {
  it.each([
    { salaries: 2820000, transfer: 580000 },
    { salaries: 2030000, transfer: 1370000 },
    { salaries: 0, transfer: 3400000 },
    { salaries: 3400000, transfer: 0 },
  ])('preserva a divisão ao validar e sincronizar: %j', (amounts) => {
    const command = { type: 'financial-plan', ...amounts };
    const parsed = commandSchema.parse(command);
    expect(parsed).toEqual(command);
    expect(commandSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(command);
    expect(commandSchema.parse({ type: 'club-settings', commands: [command] })).toEqual({
      type: 'club-settings',
      commands: [command],
    });
  });
});
