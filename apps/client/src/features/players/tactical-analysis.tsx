import { OpponentAdvice } from '../competitions/opponent-advice';
import {
  formationSchema,
  playStyleSchema,
  type WorldState,
  type Formation,
  type PlayStyle,
  type PlayerSnapshot,
} from '@football/shared';
import { tacticalBonus, STYLE_LABELS } from '@football/domain';
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
  const played = new Set(state.results.map((result) => result.fixtureId));
  const nextFixture = state.fixtures
    .filter(
      (fixture) =>
        (fixture.homeId === clubId || fixture.awayId === clubId) && !played.has(fixture.id),
    )
    .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  const combinations = formationSchema.options.flatMap((opposingFormation) =>
    playStyleSchema.options.map((opponent) => ({
      formation: opposingFormation,
      style: opponent,
      advantage:
        tacticalBonus(style, formation, opponent, opposingFormation, players) -
        tacticalBonus(opponent, opposingFormation, style, formation, players),
    })),
  );
  const strong = combinations
    .filter((row) => row.advantage > 0.05)
    .sort((a, b) => b.advantage - a.advantage);
  const weak = combinations
    .filter((row) => row.advantage < -0.05)
    .sort((a, b) => a.advantage - b.advantage);
  return (
    <PlayerModal
      title="Análise tática"
      hideTitle
      className="tactical-analysis-modal"
      onClose={onClose}
    >
      <div className="tactical-board-clip" aria-hidden="true">
        <i />
        <i />
      </div>
      {nextFixture && <OpponentAdvice state={state} fixture={nextFixture} clubId={clubId} />}
      <div className="tactical-analysis-selection">
        <small className="tactical-current-label">Tática atual</small>
        <Icon name="pitch" size={28} />
        <strong>{formation}</strong>
        <span>{STYLE_LABELS[style]}</span>
      </div>
      <div className="tactical-analysis-columns">
        {[
          { title: 'Forte contra', rows: strong, tone: 'strong', icon: 'trophy' },
          { title: 'Fraco contra', rows: weak, tone: 'weak', icon: 'shield' },
        ].map((group) => (
          <section key={group.tone} className={`tactical-analysis-group ${group.tone}`}>
            <h3>
              <Icon name={group.icon} />
              {group.title}
              <small>{group.rows.length}</small>
            </h3>
            <div className="tactical-analysis-list">
              {formationSchema.options.map((scheme) => {
                const styles = group.rows.filter((row) => row.formation === scheme);
                if (!styles.length) return null;
                return (
                  <section className="tactical-analysis-scheme" key={scheme} aria-label={scheme}>
                    <h4>
                      <Icon name="pitch" size={16} />
                      {scheme}
                    </h4>
                    <ul>
                      {styles.map((row) => (
                        <li key={row.style}>{STYLE_LABELS[row.style]}</li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              {!group.rows.length && <p>Nenhuma combinação com vantagem relevante.</p>}
            </div>
          </section>
        ))}
      </div>
    </PlayerModal>
  );
}
