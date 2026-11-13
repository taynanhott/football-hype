import { Icon } from '../../ui/icons';
import { Select, Option } from '../../ui/select';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PlayerModal } from '../players/player-modal';
import { currency } from '../../ui/format';
import { CENTER_SERVICES, clubKit } from '@football/shared';
import { ageFatigueFactor, expectedTrainingGain } from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { Portrait } from '../players/pixel-portrait';
import { positionLabel } from '../../ui/position-label';
import { useGameStore } from '../../store/game-store';

export function IndividualTrainingRoster({
  snapshot,
  club,
  center,
  draft,
  onLoadChange,
}: ViewProps & {
  draft: Record<string, 'light' | 'moderate' | 'intense'>;
  onLoadChange: (id: string, load: 'light' | 'moderate' | 'intense') => void;
}) {
  const send = useGameStore((state) => state.send);
  const busy = useGameStore((state) => state.busy);
  const state = snapshot.state;
  const [order, setOrder] = useState('overall');
  const orderedPlayers = club.playerIds
    .flatMap((id) => (state.players.byId[id] ? [state.players.byId[id]!] : []))
    .sort((a, b) => {
      if (order === 'age') return a.age - b.age || b.overall - a.overall;
      if (order === 'position')
        return (
          ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'RM', 'LM', 'AM', 'RW', 'LW', 'SS', 'ST'].indexOf(
            a.position,
          ) -
            ['GK', 'CB', 'RB', 'LB', 'DM', 'CM', 'RM', 'LM', 'AM', 'RW', 'LW', 'SS', 'ST'].indexOf(
              b.position,
            ) || b.overall - a.overall
        );
      if (['light', 'moderate', 'intense'].includes(order)) {
        const matches = (id: string) =>
          Number((center.operations?.playerLoads?.[id] ?? 'moderate') === order);
        return matches(b.id) - matches(a.id) || b.overall - a.overall;
      }
      return b.overall - a.overall || a.name.localeCompare(b.name);
    });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmPlayer = state.players.byId[confirmId ?? ''];
  const cost = CENTER_SERVICES.individual;
  const activeCount = center.operations?.individual.length ?? 0;
  const slots = Math.min(3, center.levels.coaching);
  return (
    <section className="individual-training-roster" aria-label="Treino dos jogadores">
      <div className="section-header training-roster-header">
        <h3>Treino por jogador</h3>
        <span>{club.playerIds.length} atletas</span>
        <label className="training-roster-sort">
          <span className="training-sort-caption">Ordenar por</span>
          <Select value={order} onValueChange={setOrder} aria-label="Ordenar treino por">
            <Option value="age">Idade</Option>
            <Option value="position">Posição</Option>
            <Option value="overall">Overall</Option>
            <Option value="light">Treino leve</Option>
            <Option value="moderate">Treino moderado</Option>
            <Option value="intense">Treino intenso</Option>
          </Select>
        </label>
        <div className="training-save-bar">
          <button
            className="primary"
            disabled={
              busy ||
              !Object.entries(draft).some(
                ([id, load]) => load !== (center.operations?.playerLoads?.[id] ?? 'moderate'),
              )
            }
            onClick={() => {
              useGameStore.getState().clearError();
              send({
                type: 'management',
                action: 'center',
                target: 'save-training',
                playerLoads: draft,
              });
            }}
          >
            {busy ? 'Salvando…' : 'Salvar treino'}
          </button>
        </div>
      </div>
      <div className="training-roster-list">
        {orderedPlayers.map((player) => {
          const id = player.id;
          const load = draft[id] ?? center.operations?.playerLoads?.[id] ?? 'moderate';
          const injured = (state.injuries[id] ?? 0) > 0;
          const cycle = center.operations?.individual.find((plan) => plan.playerId === id);
          const veteran = player.age > 33;
          const atPotential = !veteran && player.overall >= player.potential;
          const special = center.operations?.progression?.[id];
          const progress = Math.min(100, Math.max(0, (state.development[id] ?? 0) * 100));
          const projected = expectedTrainingGain(state, player);
          const effort = center.operations?.effort?.[id] ?? 0;
          const form = Math.max(
            0,
            Math.round(
              100 -
                effort * 5 -
                (state.workload[id]?.consecutiveMatches ?? 0) * 2 * ageFatigueFactor(player.age),
            ),
          );
          const tier =
            player.overall <= 69
              ? 'bronze'
              : player.overall <= 77
                ? 'silver'
                : player.overall <= 85
                  ? 'gold'
                  : 'diamond';
          const potentialTier =
            player.potential <= 69
              ? 'bronze'
              : player.potential <= 77
                ? 'silver'
                : player.potential <= 85
                  ? 'gold'
                  : 'diamond';
          return (
            <article className="training-player-row" key={id}>
              <Portrait player={player} clubName={club.name} kit={clubKit(club)} />
              <div className="training-player-info">
                <strong>{player.name}</strong>
                <small>
                  {positionLabel(player.position)} · {player.age} anos
                  {injured ? ' · Lesionado' : ''}
                  {state.management?.contractHistory?.[id]?.dissatisfied
                    ? ' · Evolução pausada: contrato'
                    : ''}
                </small>
                <div
                  className="individual-load-buttons"
                  role="group"
                  aria-label={'Carga de ' + player.name}
                >
                  {(
                    [
                      ['light', 'Leve'],
                      ['moderate', 'Moderado'],
                      ['intense', 'Intenso'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      data-load={value}
                      aria-pressed={load === value}
                      disabled={busy || injured}
                      onClick={() => onLoadChange(id, value)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="start-individual-training"
                    disabled={busy || injured || Boolean(cycle) || activeCount >= slots}
                    title={
                      cycle
                        ? 'Ciclo individual em andamento'
                        : activeCount >= slots
                          ? 'Todas as vagas estão ocupadas'
                          : 'Iniciar ciclo individual de 60 dias'
                    }
                    onClick={() => setConfirmId(id)}
                  >
                    {cycle ? (injured ? 'Pausado por lesão' : 'Em treino') : 'Individual'}
                  </button>
                  {cycle && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Remover ${player.name} do treino individual`}
                      title="Libera a vaga sem devolver o pagamento realizado."
                      onClick={() =>
                        send({
                          type: 'management',
                          action: 'center',
                          target: 'remove-individual',
                          playerId: id,
                        })
                      }
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
              <div className="training-player-meters">
                <div
                  className="training-condition"
                  title={
                    'Condicionamento: ' +
                    Math.round(player.fitness) +
                    '% · Forma física: ' +
                    form +
                    '%'
                  }
                >
                  <span>COND. {Math.round(player.fitness)}%</span>
                  <meter
                    min="0"
                    max="100"
                    value={player.fitness}
                    aria-label={'Condicionamento de ' + player.name}
                  />
                </div>
                <div
                  className={`training-growth ${veteran ? 'decline' : atPotential ? 'bonus' : ''}`}
                  title="Projeção até o fim da temporada pela média real de todos os treinos e jogos registrados; trocar a carga não altera o histórico"
                >
                  <span>
                    {injured
                      ? 'Pausado por lesão'
                      : (projected >= 0 ? '+' : '−') +
                        Math.abs(projected).toFixed(1).replace('.', ',') +
                        '/temp.'}
                  </span>
                  <meter
                    min="0"
                    max="100"
                    value={
                      veteran
                        ? (special?.declineProgress ?? 0) * 100
                        : atPotential
                          ? (special?.buffProgress ?? 0) * 100
                          : progress
                    }
                    aria-label={'Progresso para +1 de overall de ' + player.name}
                  />
                </div>
                <span
                  className="training-overall-potential"
                  aria-label={'Overall ' + player.overall + ', potencial ' + player.potential}
                  title="Overall → Potencial"
                >
                  <b className={'training-current-overall ' + tier}>{player.overall}</b>
                  <span aria-hidden="true">→</span>
                  <b className={'training-current-overall ' + potentialTier}>{player.potential}</b>
                </span>
              </div>
            </article>
          );
        })}
      </div>
      {confirmPlayer &&
        createPortal(
          <PlayerModal
            className="individual-training-confirm"
            title="Confirmar treino individual"
            titleIcon={<Icon name="ball" size={18} />}
            hideClose
            onClose={() => setConfirmId(null)}
          >
            <div className="training-confirm-player">
              <Portrait player={confirmPlayer} clubName={club.name} kit={clubKit(club)} />
              <div>
                <strong>{confirmPlayer.name}</strong>
                <span>
                  {positionLabel(confirmPlayer.position)} · {confirmPlayer.age} anos
                </span>
              </div>
              <span className="training-confirm-badge">CT</span>
            </div>
            <dl className="training-confirm-summary">
              <div>
                <dt>Duração do ciclo</dt>
                <dd>60 dias</dd>
              </div>
              <div>
                <dt>Custo único</dt>
                <dd>{currency(cost)}</dd>
              </div>
            </dl>
            <section className="training-confirm-outcome">
              <h3>Ao concluir o treino</h3>
              <p>
                {confirmPlayer.age > 33
                  ? 'Reduz gradualmente a barra de desgaste até zero, sem recuperar overall perdido. O nível do CT melhora o efeito.'
                  : confirmPlayer.age < 33
                    ? confirmPlayer.overall < confirmPlayer.potential
                      ? 'Evolução acelerada em 50%, respeitando idade e proximidade do potencial.'
                      : '+1 de bônus temporário por 15 jogos oficiais ao concluir.'
                    : 'Evolução gradual até o potencial; sem bônus automático ao concluir.'}
              </p>
            </section>
            <div className="career-confirm-actions">
              <button type="button" className="secondary" onClick={() => setConfirmId(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                disabled={
                  busy ||
                  (state.injuries[confirmPlayer.id] ?? 0) > 0 ||
                  club.balance.cents < cost ||
                  activeCount >= slots ||
                  Boolean(center.operations?.individual.some((plan) => plan.playerId === confirmId))
                }
                onClick={() => {
                  send({
                    type: 'management',
                    action: 'center',
                    target: 'individual',
                    playerId: confirmPlayer.id,
                  });
                  setConfirmId(null);
                }}
              >
                {busy ? 'Salvando…' : 'Iniciar treino'}
              </button>
            </div>
            {club.balance.cents < cost && (
              <p className="training-confirm-warning" role="status">
                Saldo insuficiente para iniciar o ciclo.
              </p>
            )}
            {activeCount >= slots && (
              <p className="training-confirm-warning" role="status">
                Todas as vagas de treino individual estão ocupadas.
              </p>
            )}
          </PlayerModal>,
          document.body,
        )}
    </section>
  );
}
