import type { WorldState } from '@football/shared';

export function newsPlayerMentions(players: WorldState['players']['byId']) {
  const names = new Map<string, { kind: 'player' | 'club'; id: string }>();
  for (const player of Object.values(players)) {
    if (player.name.length > 2 && !names.has(player.name))
      names.set(player.name, { kind: 'player', id: player.id });
  }
  // Only Junior's own names qualify; namesakes such as Neymar Uribe must not take this alias.
  const neymar = Object.values(players).find((player) =>
    /^(?:Neymar(?:\s+(?:J[uú]nior|Jr\.?))?|Neymar da Silva Santos J[uú]nior)$/i.test(
      player.name.trim(),
    ),
  );
  if (neymar) names.set('Neymar', { kind: 'player', id: neymar.id });
  return names;
}
