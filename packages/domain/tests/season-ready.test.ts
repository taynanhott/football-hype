import { describe, it, expect } from 'vitest';
import { createWorld } from '../src/index.js';
import { handleCommand } from '../src/game/command-handlers.js';
import { IDS, unwrap } from '../../../tests/fixtures/domain.js';
import type { WorldState } from '@football/shared';
const now = Date.parse('2026-10-26T15:00:00Z');
function finished(count = 4): WorldState {
  const s = unwrap(
    createWorld({ id: IDS.league, userId: IDS.user, name: 'Maioria', mode: 'multiplayer', now }),
  );
  return {
    ...s,
    status: 'finished',
    participants: Array.from({ length: count }, (_, i) => ({
      userId: i === 0 ? IDS.user : `coach-${i}`,
      clubId: s.clubs.ids[i]!,
      ready: false,
    })),
  };
}
function command(s: WorldState, userId: string, type: 'ready' | 'new-season') {
  const p = s.participants.find((p) => p.userId === userId)!;
  return handleCommand({
    state: s,
    club: s.clubs.byId[p.clubId]!,
    userId,
    now,
    eventId: 'event',
    command: type === 'ready' ? { type: 'ready', ready: true } : { type: 'new-season' },
  });
}
describe('maioria para próxima temporada', () => {
  it('administrador não ignora votos e empate não basta', () => {
    const s = finished();
    expect(command(s, IDS.user, 'new-season').ok).toBe(false);
    const half = { ...s, participants: s.participants.map((p, i) => ({ ...p, ready: i < 2 })) };
    expect(command(half, IDS.user, 'new-season').ok).toBe(false);
  });
  it('o voto que completa a maioria inicia a temporada e limpa votos', () => {
    let s = finished();
    for (const userId of [IDS.user, 'coach-1']) {
      s = unwrap(command(s, userId, 'ready')).next;
      expect(s.status).toBe('finished');
    }
    const next = unwrap(command(s, 'coach-2', 'ready')).next;
    expect(next.status).toBe('active');
    expect(next.season).toBe(s.season + 1);
    expect(next.participants.every((p) => !p.ready)).toBe(true);
  });
  it('na carreira solo o próprio pronto é a maioria', () => {
    const s = { ...finished(1), mode: 'offline' as const };
    expect(unwrap(command(s, IDS.user, 'ready')).next.season).toBe(s.season + 1);
  });
});
