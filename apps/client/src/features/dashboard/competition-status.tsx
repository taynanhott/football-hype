import { COMPETITIONS } from '@football/shared';
import { cupGroupTables } from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { Icon } from '../../ui/icons';

export function CompetitionStatus({ snapshot, club }: ViewProps) {
  const { state, tables } = snapshot;
  const completed = new Set(state.results.map((result) => result.fixtureId));
  const rows = COMPETITIONS.flatMap((rule) => {
    const fixtures = state.fixtures.filter(
      (game) =>
        game.competitionId === rule.id && (game.homeId === club.id || game.awayId === club.id),
    );
    const nodes = state.cups.filter((node) => node.competitionId === rule.id);
    const ownNodes = nodes
      .filter((node) => node.homeId === club.id || node.awayId === club.id)
      .sort((a, b) => b.round - a.round);
    const table = tables[rule.id];
    const place = table?.findIndex((row) => row.id === club.id) ?? -1;
    if (!fixtures.length && !ownNodes.length && place < 0) return [];
    const trophy = state.trophies.some(
      (trophy) =>
        trophy.clubId === club.id &&
        trophy.competitionId === rule.id &&
        trophy.season === state.season,
    );
    let label = 'A iniciar';
    let eliminated = false;
    if (rule.format === 'league' && place >= 0) label = place + 1 + 'º lugar';
    else if (ownNodes.length) {
      const node = ownNodes[0]!;
      const final = Math.max(...nodes.map((node) => node.round));
      label =
        node.label ??
        ['Final', 'Semifinal', 'Quartas de final', 'Oitavas de final'][final - node.round] ??
        'Fase ' + (node.round + 1);
      eliminated = Boolean(node.winnerId && node.winnerId !== club.id);
      if (node.winnerId === club.id && node.round !== final) label += ' · Classificado';
    } else {
      const group = cupGroupTables(state, rule.id).find((group) =>
        group.table.some((row) => row.id === club.id),
      );
      if (group) {
        const position = group.table.findIndex((row) => row.id === club.id) + 1;
        label = 'Grupo ' + group.group + ' · ' + position + 'º';
        const ended = group.fixtures.every((game) => completed.has(game.id));
        eliminated = ended && position > 2 && rule.id !== 'serie-c';
      }
    }
    if (trophy) label = 'Campeão';
    return [{ id: rule.id, name: rule.name, label, eliminated, trophy }];
  });
  return (
    <section className="panel dashboard-competitions">
      <div className="section-header">
        <h2>
          <Icon name="trophy" />
          Nos campeonatos
        </h2>
        <a href="#/calendar">Ver torneios ↗</a>
      </div>
      <div className="dashboard-competition-list">
        {rows.map((row) => (
          <div
            className={`dashboard-competition-row ${row.eliminated ? 'is-eliminated' : ''}`}
            key={row.id}
          >
            <Icon name={row.trophy ? 'trophy' : 'calendar'} size={18} />
            <strong>{row.name}</strong>
            <span>
              {row.label}
              {row.eliminated && <small>Eliminado</small>}
            </span>
          </div>
        ))}
        {!rows.length && <p>Nenhuma participação registrada nesta temporada.</p>}
      </div>
    </section>
  );
}
