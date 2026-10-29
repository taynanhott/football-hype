import { GeneratedPerson } from '../../ui/person-avatar';
import { FitnessGym } from './fitness-gym';
import { useState } from 'react';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { currency } from '../../ui/format';
import { Select, Option } from '../../ui/select';

import { SECTORS, MARKETING_BENEFITS } from './center-sectors';
export function SectorGuide({ sector }: { sector: string }) {
  const info = SECTORS[sector];
  if (!info) return null;
  return (
    <div className="sector-guide">
      <span className="sector-avatar" role="img" aria-label={info.person}>
        <GeneratedPerson name={info.person} />
      </span>
      <div>
        <strong>{info.person}</strong>
        <p>{info.tip}</p>
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
}: ViewProps & { sector: string; onCustomize: () => void }) {
  const send = useGameStore((s) => s.send);
  const busy = useGameStore((s) => s.busy);
  const [playerId, setPlayerId] = useState('');
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
  const cost = treatment ? (medical ? 5000000 : 2500000) : 10000000;
  const eligible = players.filter((p) =>
    treatment
      ? !active.includes(p.id) && (medical ? (state.injuries[p.id] ?? 0) > 0 : p.fitness < 100)
      : p.overall < 99 && !ops?.individual.some((t) => t.playerId === p.id),
  );
  const occupied = treatment ? active.length : (ops?.individual.length ?? 0);
  return (
    <div className={`center-management sector-${sector}`}>
      <SectorGuide sector={sector} />
      <p className="management-passive">
        {sector === 'fitness'
          ? 'Benefício passivo: descanso mais rápido entre partidas, ampliado a cada nível.'
          : medical
            ? 'Benefício passivo: menor probabilidade e gravidade das lesões a cada nível.'
            : sector === 'coaching'
              ? 'Benefício passivo: evolução até o potencial mais rápida e menor perda de overall com a idade.'
              : 'Benefícios automáticos de acordo com o desenvolvimento do setor.'}
      </p>
      {sector === 'coaching' && (
        <section className="management-block">
          <h3>Carga de treino do elenco</h3>
          <div className="training-load">
            {(
              [
                ['light', 'Leve', 'Menor evolução, cansaço e risco'],
                ['moderate', 'Moderado', 'Evolução, cansaço e risco médios'],
                ['intense', 'Intenso', 'Maior evolução, cansaço e risco'],
              ] as const
            ).map(([value, label, description]) => (
              <button
                key={value}
                aria-pressed={(ops?.load ?? 'moderate') === value}
                disabled={busy}
                onClick={() => act(value)}
              >
                <strong>{label}</strong>
                <span>{description}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {(treatment || sector === 'coaching') && (
        <section className="management-block">
          <div className="section-header">
            <h3>{treatment ? 'Tratamento Plus' : 'Treino individual'}</h3>
            <span className="pill">
              {occupied} / {slots} vagas
            </span>
          </div>
          <p>
            {treatment
              ? 'Recuperação 50% mais rápida. Pagamento único por atendimento; a vaga é liberada ao terminar a recuperação.'
              : 'Ciclo de 60 dias no calendário: evolução 50% mais rápida nos treinos e +1 de overall ao concluir. Uma vaga por nível até o nível 3.'}
          </p>
          {slots === 0 ? (
            <div className="locked-feature">
              🔒 Disponível no nível 3. Níveis 4 e 5 liberam mais uma vaga cada.
            </div>
          ) : (
            <>
              <label>
                Selecionar jogador
                <Select
                  aria-label="Selecionar jogador para atendimento"
                  value={playerId}
                  onValueChange={setPlayerId}
                >
                  <Option value="">Escolha um jogador</Option>
                  {eligible.map((p) => (
                    <Option key={p.id} value={p.id}>
                      {p.name} ·{' '}
                      {medical
                        ? `${state.injuries[p.id]} dias de recuperação`
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
              {eligible.length === 0 && <p>Nenhum jogador elegível no momento.</p>}
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
                    </div>
                  ))
                : ops?.individual.map((t) => (
                    <div key={t.playerId}>
                      <strong>{state.players.byId[t.playerId]?.name ?? 'Jogador'}</strong>
                      <span>
                        {Math.max(0, Math.ceil((t.endsAt - state.lastProcessedAt) / 86400000))} dias
                        restantes · +1 OVR ao concluir
                      </span>
                    </div>
                  ))}
            </div>
          )}
        </section>
      )}
      {medical && (
        <section className="management-block">
          <h3>Seringa · liberação para uma partida</h3>
          <p>
            Permite que um lesionado jogue a próxima partida do clube no calendário. A lesão
            permanece. Estoque máximo: uma unidade.
          </p>
          {level < 5 ? (
            <div className="locked-feature">🔒 Disponível no nível 5</div>
          ) : (
            <>
              <p>Estoque: {ops?.syringe ? '1 / 1' : '0 / 1'}</p>
              <button
                className="secondary full"
                disabled={
                  busy || !!ops?.syringe || !!ops?.clearance || club.balance.cents < 15000000
                }
                onClick={() => act('buy-syringe')}
              >
                Comprar seringa · {currency(15000000)}
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
              <li key={benefit} className={level > i ? 'unlocked' : ''}>
                <span>
                  {level > i ? '✓' : '🔒'} Nível {i + 1}
                </span>
                <strong>{benefit}</strong>
              </li>
            ))}
          </ol>
          <button className="secondary full" onClick={onCustomize}>
            Personalizar clube ↗
          </button>
        </>
      )}
    </div>
  );
}
