import { useState } from 'react';
import {
  FORMATION_LABELS,
  FORMATIONS,
  formationSchema,
  playStyleSchema,
  type WorldState,
  type Formation,
  type PlayStyle,
  type PlayerSnapshot,
} from '@football/shared';
import { resolveLineup, lineupTacticalBonus, tacticalBonus, STYLE_LABELS } from '@football/domain';
import { GeneratedPerson } from '../../ui/person-avatar';
import { PlayerModal } from './player-modal';
import { Icon } from '../../ui/icons';

export function TacticalAnalysis({
  state,
  clubId,
  formation,
  style,
  players,
  onClose,
}: {
  state: WorldState;
  clubId: string;
  formation: Formation;
  style: PlayStyle;
  players: readonly PlayerSnapshot[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'strong' | 'weak'>('strong');
  const lineup = resolveLineup(
    state,
    state.clubs.byId[clubId]!,
    state.nextScheduledAt,
    state.players.byId,
    formation,
    players.map((p) => p.id),
    style,
  );
  const bonus = lineupTacticalBonus(lineup);
  const average = Math.floor(
    Math.min(99, lineup.reduce((sum, p) => sum + p.effectiveOverall, 0) / 11 + bonus),
  );
  const chemistry = Math.floor(lineup.reduce((sum, p) => sum + p.chemistry, 0) / 11);
  const formatted = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  // Compare tactical matchups with equal player quality; team ratings stay in the summary.
  const referencePlayers = (shape: Formation) =>
    FORMATIONS[shape].flatMap((slot, index) =>
      players[index]
        ? [{ ...players[index]!, position: slot.position, overall: 80, fitness: 100 }]
        : [],
    );
  const ownReference = referencePlayers(formation);
  const matchups = formationSchema.options.flatMap((opposingFormation) =>
    playStyleSchema.options.map((opposingStyle) => ({
      formation: opposingFormation,
      style: opposingStyle,
      advantage:
        tacticalBonus(style, formation, opposingStyle, opposingFormation, ownReference) -
        tacticalBonus(
          opposingStyle,
          opposingFormation,
          style,
          formation,
          referencePlayers(opposingFormation),
        ),
    })),
  );
  const rows = matchups.filter((row) =>
    tab === 'strong' ? row.advantage > 0.05 : row.advantage < -0.05,
  );
  return (
    <PlayerModal title="Análise tática" className="tactical-analysis-modal" onClose={onClose}>
      <section className="tactical-coach-note">
        <GeneratedPerson name="Auxiliar técnico" outfit="#174638" />
        <p>
          {chemistry === 100
            ? `O grupo está afinado. Este esquema já nos dá +${formatted(bonus)} de overall.`
            : `Com este esquema, o grupo rende +${formatted(bonus)} de overall. Vamos manter a base para chegar a +3.`}
        </p>
      </section>
      <div className="tactical-analysis-selection">
        <Icon name="pitch" size={24} />
        <strong>{FORMATION_LABELS[formation]}</strong>
        <span>{STYLE_LABELS[style]}</span>
      </div>
      <div className="tactical-result-metrics">
        <div>
          <small>Bônus tático</small>
          <strong>+{formatted(bonus)}</strong>
        </div>
        <div>
          <small>Overall final</small>
          <strong>{average}</strong>
        </div>
        <div>
          <small>Entrosamento</small>
          <strong>{chemistry}%</strong>
        </div>
      </div>
      <div
        className="tactical-mobile-tabs tactical-summary-tabs"
        role="tablist"
        aria-label="Vantagens e cuidados"
      >
        <button role="tab" aria-selected={tab === 'strong'} onClick={() => setTab('strong')}>
          <Icon name="trophy" size={18} />
          Prós
        </button>
        <button role="tab" aria-selected={tab === 'weak'} onClick={() => setTab('weak')}>
          <Icon name="shield" size={18} />
          Contras
        </button>
      </div>
      <div
        className={
          'tactical-matchup-list tactical-coach-points ' +
          (tab === 'strong' ? 'positive' : 'negative')
        }
        role="tabpanel"
        aria-label={tab === 'strong' ? 'Táticas favoráveis' : 'Táticas desfavoráveis'}
      >
        {formationSchema.options.map((scheme) => {
          const styles = rows.filter((row) => row.formation === scheme);
          return styles.length ? (
            <section className="tactical-matchup-group" key={scheme}>
              <h3>
                <Icon name="pitch" size={18} />
                {FORMATION_LABELS[scheme]}
              </h3>
              <ul>
                {styles.map((row) => (
                  <li key={row.style}>{STYLE_LABELS[row.style]}</li>
                ))}
              </ul>
            </section>
          ) : null;
        })}
        {!rows.length && (
          <p>Nenhuma tática com {tab === 'strong' ? 'vantagem' : 'desvantagem'} relevante.</p>
        )}
      </div>
    </PlayerModal>
  );
}
