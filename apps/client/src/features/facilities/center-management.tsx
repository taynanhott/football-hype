import { Icon } from '../../ui/icons';
import { CENTER_SERVICES } from '@football/shared';
import { IndividualTrainingRoster } from './individual-training-roster';
import { GeneratedPerson } from '../../ui/person-avatar';
import { FitnessGym } from './fitness-gym';
import { useState } from 'react';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { currency } from '../../ui/format';
import { Select, Option } from '../../ui/select';

import { SECTORS, MARKETING_BENEFITS } from './center-sectors';
function FacilityLevelLock({
  level,
  required,
  detail,
}: {
  level: number;
  required: number;
  detail?: string;
}) {
  return (
    <div className="locked-feature facility-level-lock" role="note">
      <span className="facility-level-lock-icon" aria-hidden="true">
        <Icon name="lock" size={22} />
      </span>
      <div>
        <strong>Disponível no nível {required}</strong>
        <span>
          Seu setor está no nível {level}.{detail ? ` ${detail}` : ''}
        </span>
      </div>
      <span className="facility-level-lock-badge" aria-hidden="true">
        NV. {required}
      </span>
    </div>
  );
}
export function SectorGuide({ sector, rules = false }: { sector: string; rules?: boolean }) {
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const info = SECTORS[sector];
  if (!info) return null;
  return (
    <div className="sector-guide">
      <span className="sector-avatar" role="img" aria-label={info.person}>
        <GeneratedPerson name={info.person} />
      </span>
      <div>
        <strong>{info.person}</strong>
        {rules ? (
          <>
            <button
              type="button"
              className="coordinator-rules-toggle"
              aria-expanded={rulesExpanded}
              onClick={() => setRulesExpanded((value) => !value)}
            >
              <span>
                {rulesExpanded ? 'Vamos entender o treinamento' : 'Quer entender como funciona?'}
              </span>
              <small>{rulesExpanded ? 'Clique para recolher ▴' : 'Clique para expandir ▾'}</small>
            </button>
            <div className="coordinator-training-rules" data-expanded={rulesExpanded}>
              <p>
                <b>Até alcançar o potencial</b> · Treinos e jogos oficiais preenchem a barra de
                evolução. Cada barra completa aumenta +1 de overall, até o potencial. No ciclo
                individual, a evolução é acelerada em 50%, respeitando esse limite. Jovens evoluem
                mais e os últimos cinco pontos até o potencial exigem mais tempo.
              </p>
              <p>
                <b>Potencial alcançado</b> · A barra amarela carrega devagar no intenso, mantém no
                moderado e regride no leve. Ao completar, concede bônus de treinamento, até +3. No
                ciclo individual, menores de 33 anos recebem +1 temporário por 15 jogos em que
                atuarem.
              </p>
              <p>
                <b>Acima de 33 anos</b> · A barra vermelha representa desgaste: leve avança
                normalmente, moderado avança devagar e intenso pausa. O ciclo individual reduz a
                barra até zero, sem devolver overall já perdido.
              </p>
              <p className="coordinator-training-note">
                O ciclo dura 60 dias. Jogos oficiais contam como treino intenso para quem atua. O
                nível do CT melhora os efeitos, e a projeção por temporada usa o histórico real de
                treinos e jogos.
              </p>
            </div>
          </>
        ) : (
          <p>{info.tip}</p>
        )}
      </div>
    </div>
  );
}
export function CenterManagement({
  sector,
  center,
  club,
  snapshot,
  onCustomize,
  trainingDraft,
  onTrainingChange,
}: ViewProps & {
  sector: string;
  onCustomize: () => void;
  trainingDraft: Record<string, 'light' | 'moderate' | 'intense'>;
  onTrainingChange: (id: string, load: 'light' | 'moderate' | 'intense') => void;
}) {
  const send = useGameStore((s) => s.send);
  const busy = useGameStore((s) => s.busy);
  const [playerId, setPlayerId] = useState('');
  const [individualExpanded, setIndividualExpanded] = useState(false);
  const state = snapshot.state;
  const ops = center.operations;
  const level = center.levels[sector as keyof typeof center.levels];
  const players = club.playerIds.flatMap((id) =>
    state.players.byId[id] ? [state.players.byId[id]!] : [],
  );
  const act = (target: string) =>
    send({ type: 'management', action: 'center', target, ...(playerId ? { playerId } : {}) });
  const medical = sector === 'medical';
  const treatment = medical || sector === 'fitness';
  const active = medical ? (ops?.medical ?? []) : (ops?.fitness ?? []);
  const slots = treatment ? Math.max(0, level - 2) : Math.min(3, level);
  const cost = treatment
    ? medical
      ? CENTER_SERVICES.medicalPerDay * (state.injuries[playerId] ?? 0)
      : CENTER_SERVICES.fitness
    : CENTER_SERVICES.individual;
  const syringeDays = Math.max(
    0,
    Math.ceil(((ops?.syringeAvailableAt ?? 0) - state.lastProcessedAt) / 86400000),
  );
  const eligible = players.filter((p) =>
    treatment
      ? !active.includes(p.id) && (medical ? (state.injuries[p.id] ?? 0) > 1 : p.fitness < 100)
      : p.overall < 99 && !ops?.individual.some((t) => t.playerId === p.id),
  );
  const occupied = treatment ? active.length : (ops?.individual.length ?? 0);
  return (
    <div className={`center-management sector-${sector}`}>
      <div className="center-management-content">
        <SectorGuide sector={sector} rules={sector === 'coaching'} />
        {!treatment && sector !== 'coaching' && (
          <p className="management-passive">
            {sector === 'fitness'
              ? 'Benefício passivo: descanso mais rápido entre partidas, ampliado a cada nível.'
              : medical
                ? 'Benefício passivo: menor probabilidade e gravidade das lesões a cada nível.'
                : sector === 'coaching'
                  ? 'Benefício passivo: evolução até o potencial mais rápida e menor perda de overall com a idade.'
                  : 'Benefícios automáticos de acordo com o desenvolvimento do setor.'}
          </p>
        )}
        {(treatment || sector === 'coaching') && (
          <section className="management-block">
            <div className="section-header">
              <h3
                className={sector === 'coaching' ? 'individual-training-desktop-title' : undefined}
              >
                {treatment ? 'Tratamento Plus' : 'Treino individual'}
              </h3>
              {sector === 'coaching' && (
                <button
                  type="button"
                  className="individual-training-toggle"
                  aria-expanded={individualExpanded}
                  onClick={() => setIndividualExpanded((value) => !value)}
                >
                  Treino individual {individualExpanded ? '▴' : '▾'}
                </button>
              )}
              <span className="pill">
                {occupied} / {slots} vagas
              </span>
            </div>
            <div
              className="individual-training-expandable"
              data-collapsible={sector === 'coaching'}
              data-expanded={individualExpanded}
            >
              {treatment && (
                <p>
                  Recuperação 50% mais rápida. Pagamento único por atendimento; a vaga é liberada ao
                  terminar a recuperação.
                </p>
              )}
              {sector === 'coaching' ? null : slots === 0 ? (
                <FacilityLevelLock
                  level={level}
                  required={3}
                  detail="Níveis 4 e 5 liberam mais uma vaga cada."
                />
              ) : (
                <>
                  <label>
                    Selecionar jogador
                    <Select
                      aria-label="Selecionar jogador para atendimento"
                      value={playerId}
                      onValueChange={setPlayerId}
                    >
                      <Option value="" disabled={eligible.length === 0}>
                        {eligible.length === 0 ? 'Nenhum jogador elegível' : 'Escolha um jogador'}
                      </Option>
                      {eligible.map((p) => (
                        <Option key={p.id} value={p.id}>
                          {p.name} ·{' '}
                          {medical
                            ? `${state.injuries[p.id]} dias · ${currency(CENTER_SERVICES.medicalPerDay * (state.injuries[p.id] ?? 0))}`
                            : `${Math.round(p.fitness)}% de condição · OVR ${p.overall}`}
                        </Option>
                      ))}
                    </Select>
                  </label>
                  <button
                    className="primary full"
                    disabled={
                      busy ||
                      !eligible.some((p) => p.id === playerId) ||
                      occupied >= slots ||
                      club.balance.cents < cost
                    }
                    onClick={() => act(treatment ? sector : 'individual')}
                  >
                    Iniciar · {currency(cost)}
                  </button>
                  {occupied >= slots && <p>Todas as vagas estão ocupadas.</p>}
                </>
              )}
              {(treatment && slots > 0) || sector === 'coaching' ? (
                <FitnessGym
                  club={club}
                  snapshot={snapshot}
                  active={
                    sector === 'coaching' ? (ops?.individual.map((t) => t.playerId) ?? []) : active
                  }
                  slots={sector === 'coaching' ? 3 : slots}
                  medical={medical}
                  coaching={sector === 'coaching'}
                />
              ) : (
                <div className="active-treatments">
                  {treatment
                    ? active.map((id) => (
                        <div key={id}>
                          <strong>{state.players.byId[id]?.name ?? 'Jogador'}</strong>
                          <span>Plus ativo · recuperação +50%</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              send({
                                type: 'management',
                                action: 'center',
                                target: `remove-${sector}`,
                                playerId: id,
                              })
                            }
                          >
                            Remover
                          </button>
                        </div>
                      ))
                    : ops?.individual.map((t) => (
                        <div key={t.playerId}>
                          <strong>{state.players.byId[t.playerId]?.name ?? 'Jogador'}</strong>
                          <span>
                            {Math.max(
                              0,
                              Math.ceil(
                                (t.endsAt - (t.pausedAt ?? state.lastProcessedAt)) / 86400000,
                              ),
                            )}{' '}
                            dias restantes ·{' '}
                            {t.pausedAt !== undefined ? 'Pausado por lesão' : 'evolução acelerada'}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              send({
                                type: 'management',
                                action: 'center',
                                target: 'remove-individual',
                                playerId: t.playerId,
                              })
                            }
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                </div>
              )}
            </div>
          </section>
        )}
        {medical && (
          <section className="management-block">
            <h3>Seringa · liberação para uma partida</h3>
            <p className="medical-clearance-description">
              <span className="medical-clearance-description-full">
                Permite que um lesionado jogue a próxima partida do clube no calendário. A lesão
                permanece. Estoque máximo: uma unidade.
              </span>
              <span className="medical-clearance-description-mobile">
                Libera um lesionado por 1 jogo, sem curar a lesão. Máximo: 1 seringa.
              </span>
            </p>
            {level < 5 ? (
              <FacilityLevelLock level={level} required={5} />
            ) : (
              <>
                <p>Estoque: {ops?.syringe ? '1 / 1' : '0 / 1'}</p>
                <button
                  className="secondary full"
                  disabled={
                    busy ||
                    !!ops?.syringe ||
                    !!ops?.clearance ||
                    syringeDays > 0 ||
                    club.balance.cents < CENTER_SERVICES.syringe
                  }
                  onClick={() => act('buy-syringe')}
                >
                  {syringeDays > 0
                    ? `Comprar seringa · ${syringeDays} ${syringeDays === 1 ? 'dia' : 'dias'}`
                    : `Comprar seringa · ${currency(CENTER_SERVICES.syringe)}`}
                </button>
                {ops?.syringe && (
                  <>
                    <Select
                      aria-label="Jogador para liberação médica"
                      value={playerId}
                      onValueChange={setPlayerId}
                    >
                      <Option value="">Escolha um lesionado</Option>
                      {players
                        .filter((p) => (state.injuries[p.id] ?? 0) > 0)
                        .map((p) => (
                          <Option key={p.id} value={p.id}>
                            {p.name}
                          </Option>
                        ))}
                    </Select>
                    <button
                      className="primary full"
                      disabled={
                        busy ||
                        !players.some((p) => p.id === playerId && (state.injuries[p.id] ?? 0) > 0)
                      }
                      onClick={() => act('use-syringe')}
                    >
                      Usar na próxima partida
                    </button>
                  </>
                )}
                {ops?.clearance && (
                  <p>
                    Liberação preparada para {state.players.byId[ops.clearance.playerId]?.name} na
                    próxima partida.
                  </p>
                )}
              </>
            )}
          </section>
        )}
        {sector === 'marketing' && (
          <>
            <ol className="marketing-benefits">
              {MARKETING_BENEFITS.map((benefit, i) => (
                <li key={benefit} className={level > i ? 'unlocked' : 'marketing-benefit-locked'}>
                  <div className="marketing-benefit-icon">
                    <Icon name={['shirt', 'shorts', 'squad', 'finance', 'stadium'][i]!} size={24} />
                  </div>
                  <div className="marketing-benefit-copy">
                    <span>
                      {level > i ? '✓ Liberado' : 'Disponível'} no nível {i + 1}
                    </span>
                    <strong>{benefit}</strong>
                  </div>
                  {level <= i && (
                    <span className="marketing-benefit-lock" aria-label="Bloqueado">
                      <Icon name="lock" size={18} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <section className="marketing-club-identity">
              <div>
                <Icon name="shield" size={26} />
                <h3>Identidade do clube</h3>
              </div>
              <button className="primary full" onClick={onCustomize}>
                <Icon name="settings" size={18} /> Personalizar clube{' '}
                <Icon name="arrow" size={18} />
              </button>
            </section>
          </>
        )}
      </div>
      {sector === 'coaching' && (
        <IndividualTrainingRoster
          snapshot={snapshot}
          draft={trainingDraft}
          onLoadChange={onTrainingChange}
          club={club}
          center={center}
          stadium={state.stadiums.byId[club.stadiumId]!}
        />
      )}
    </div>
  );
}
