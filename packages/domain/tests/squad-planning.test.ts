import { describe, expect, it } from 'vitest';
import { createWorld, executeCommand, applyEvent } from '../src/index.js';
import { commandSchema } from '@football/shared';
import { randomUUID } from 'node:crypto';

describe('planejamento do elenco', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  function fixture() {
    const result = createWorld({
      id: randomUUID(),
      userId: 'coach',
      name: 'Elenco',
      mode: 'offline',
      now,
    });
    if (!result.ok) throw new Error('world');
    return result.value;
  }
  it('confirma duas decisões em um único evento e revisão', () => {
    const state = fixture(),
      club = state.clubs.byId[state.participants[0]!.clubId]!;
    const command = commandSchema.parse({
      type: 'club-settings',
      commands: club.playerIds.slice(0, 2).map((playerId) => ({
        type: 'management',
        action: 'policy',
        playerId,
        available: true,
        rivals: true,
        interest: 70,
      })),
    });
    const event = executeCommand(state, command, 'coach', now, randomUUID());
    expect(event.ok).toBe(true);
    if (!event.ok) return;
    const applied = applyEvent(state, event.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.revision).toBe(state.revision + 1);
    for (const id of club.playerIds.slice(0, 2))
      expect(applied.value.management?.policies?.[id]?.available).toBe(true);
    expect(state.management?.policies?.[club.playerIds[0]!]?.available).not.toBe(true);
  });
  it('recusa o lote inteiro sem alterar o estado se uma decisão for inválida', () => {
    const state = fixture(),
      club = state.clubs.byId[state.participants[0]!.clubId]!;
    const before = JSON.stringify(state);
    const command = commandSchema.parse({
      type: 'club-settings',
      commands: [
        { type: 'management', action: 'policy', playerId: club.playerIds[0], available: true },
        { type: 'management', action: 'renew', playerId: randomUUID(), salary: 100000, years: 1 },
      ],
    });
    expect(executeCommand(state, command, 'coach', now, randomUUID()).ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('não aceita ações de calendário nem mais de cinquenta decisões no lote', () => {
    expect(
      commandSchema.safeParse({ type: 'club-settings', commands: [{ type: 'advance' }] }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        type: 'club-settings',
        commands: Array.from({ length: 51 }, () => ({
          type: 'management',
          action: 'policy',
          playerId: randomUUID(),
        })),
      }).success,
    ).toBe(false);
  });
});
