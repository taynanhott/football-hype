import type { ClubSnapshot, WorldState } from '@football/shared';

export function SquadAverages({ state, club }: { state: WorldState; club: ClubSnapshot }) {
  const players = club.playerIds.flatMap((id) =>
    state.players.byId[id] ? [state.players.byId[id]!] : [],
  );
  const groups = [
    { label: 'Geral', positions: null },
    { label: 'Ataque', positions: ['LW', 'RW', 'SS', 'ST'] },
    { label: 'Meio', positions: ['DM', 'CM', 'RM', 'LM', 'AM'] },
    { label: 'Defesa', positions: ['CB', 'RB', 'LB'] },
    { label: 'Goleiros', positions: ['GK'] },
  ];
  return (
    <div className="squad-averages" aria-label="Médias de overall do elenco completo">
      {groups.map((group) => {
        const members = players.filter(
          (player) => !group.positions || group.positions.includes(player.position),
        );
        const average = members.length
          ? Math.round(members.reduce((sum, player) => sum + player.overall, 0) / members.length)
          : '—';
        return (
          <div
            className="squad-average"
            key={group.label}
            title={`Média de overall · ${members.length} jogadores`}
          >
            <span>{group.label}</span>
            <strong>{average}</strong>
          </div>
        );
      })}
    </div>
  );
}
