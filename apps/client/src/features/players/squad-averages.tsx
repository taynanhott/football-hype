import type { ClubSnapshot, WorldState } from '@football/shared';
import { effectiveOverall, lineupTacticalBonus, resolveLineup } from '@football/domain';
import { fitnessOverall } from './lineup-overall';

export function SquadAverages({
  state,
  club,
  lineup,
  hidden = false,
}: {
  state: WorldState;
  club: ClubSnapshot;
  lineup?: ReturnType<typeof resolveLineup>;
  hidden?: boolean;
}) {
  const players = lineup
    ? lineup.flatMap((e) =>
        e.player
          ? [
              {
                ...e.player,
                position: e.position,
                overall: fitnessOverall(e.effectiveOverall, e.player.fitness),
              },
            ]
          : [],
      )
    : club.playerIds.flatMap((id) =>
        state.players.byId[id]
          ? [
              {
                ...state.players.byId[id]!,
                overall: fitnessOverall(
                  effectiveOverall(state, state.players.byId[id]!),
                  state.players.byId[id]!.fitness,
                ),
              },
            ]
          : [],
      );
  const bonus = lineup ? lineupTacticalBonus(lineup) : 0;
  const groups = [
    { label: 'Geral', positions: null },
    { label: 'Ataque', positions: ['LW', 'RW', 'SS', 'ST'] },
    { label: 'Meio', positions: ['DM', 'CM', 'RM', 'LM', 'AM'] },
    { label: 'Defesa', positions: ['CB', 'RB', 'LB', 'LWB', 'RWB'] },
    { label: 'Goleiros', positions: ['GK'] },
  ];
  return (
    <div
      className="squad-averages"
      aria-label={lineup ? 'Médias efetivas dos titulares' : 'Médias efetivas do elenco'}
    >
      {groups.map((group) => {
        const members = players.filter(
          (player) => !group.positions || group.positions.includes(player.position),
        );
        const average = members.length
          ? Math.floor(
              Math.min(
                99,
                members.reduce((sum, player) => sum + player.overall, 0) / members.length + bonus,
              ),
            )
          : '—';
        return (
          <div
            className="squad-average"
            data-tier={
              hidden || average === '—'
                ? undefined
                : average <= 69
                  ? 'bronze'
                  : average <= 77
                    ? 'silver'
                    : average <= 85
                      ? 'gold'
                      : 'diamond'
            }
            key={group.label}
            title={`Média com buffs, debuffs e condição física${lineup ? ' + bônus coletivo' : ''} · ${members.length} jogadores`}
          >
            <span>{group.label}</span>
            <strong
              className="market-overall-badge"
              data-tier={
                hidden || average === '—'
                  ? undefined
                  : average <= 69
                    ? 'bronze'
                    : average <= 77
                      ? 'silver'
                      : average <= 85
                        ? 'gold'
                        : 'diamond'
              }
            >
              {hidden ? '?' : average}
            </strong>
          </div>
        );
      })}
    </div>
  );
}
