import { Select, Option } from '../../ui/select';
import { useState } from 'react';
import { PlayerModal } from '../players/player-modal';
import { currency } from '../../ui/format';
import { clubKit } from '@football/shared';
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
  const cost = 10000000;
  const activeCount = center.operations?.individual.length ?? 0;
  const slots = Math.min(3, center.levels.coaching);
  return (
    <section className="individual-training-roster" aria-label="Treino dos jogadores">
      <div className="section-header training-roster-header">
        <h3>Treino por jogador</h3>
        <span>{club.playerIds.length} atletas</span>
        <label className="training-roster-sort">
          Ordenar por
          <Select value={order} onValueChange={setOrder}>
            <Option value="age">Idade</Option>
            <Option value="position">Posição</Option>
            <Option value="overall">Overall</Option>
            <Option value="light">Treino leve</Option>
            <Option value="moderate">Treino moderado</Option>
            <Option value="intense">Treino intenso</Option>
          </Select>
        </label>
      </div>
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
                      disabled={busy}
                      onClick={() => onLoadChange(id, value)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="start-individual-training"
                    disabled={busy || Boolean(cycle) || activeCount >= slots}
                    title={
                      cycle
                        ? 'Ciclo individual em andamento'
                        : activeCount >= slots
                          ? 'Todas as vagas estão ocupadas'
                          : 'Iniciar ciclo individual de 60 dias'
                    }
                    onClick={() => setConfirmId(id)}
                  >
                    {cycle ? 'Em treino' : 'Individual'}
                  </button>
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
                    {(projected >= 0 ? '+' : '−') + Math.abs(projected).toFixed(1) + '/temp.'}
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
      {confirmPlayer && (
        <PlayerModal
          className="individual-training-confirm"
          title="Confirmar treino individual"
          onClose={() => setConfirmId(null)}
        >
          <p>
            Iniciar um ciclo de 60 dias para <strong>{confirmPlayer.name}</strong>?
          </p>
          <p>
            {confirmPlayer.age > 33
              ? 'Reduz gradualmente a barra de desgaste até zero, sem recuperar overall perdido. O nível do CT melhora o efeito.'
              : confirmPlayer.age < 33
                ? confirmPlayer.overall < confirmPlayer.potential
                  ? '+1 de overall ao concluir, limitado ao potencial.'
                  : '+1 de bônus temporário por 15 jogos oficiais ao concluir.'
                : 'Sem ganho de overall aos 33 anos.'}
          </p>
          <p className="individual-training-price">
            Custo único: <strong>{currency(cost)}</strong>
          </p>
          <div className="career-confirm-actions">
            <button type="button" className="secondary" onClick={() => setConfirmId(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary"
              disabled={
                busy ||
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
              Confirmar treino
            </button>
          </div>
          {club.balance.cents < cost && <p role="status">Saldo insuficiente.</p>}
        </PlayerModal>
      )}
    </section>
  );
}
