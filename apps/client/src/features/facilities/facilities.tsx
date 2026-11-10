import { FacilityTabs } from './facility-tabs';
import { Select, Option } from '../../ui/select';
import { clubKit, GAMEPLAY } from '@football/shared';
import { STADIUM_SKINS, linkedStadiumSkin } from '../../three/stadium-catalog';
import { SECTORS, MARKETING_BENEFITS } from './center-sectors';
import { CenterManagement, SectorGuide } from './center-management';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { upgradePrice, maintenanceForLevel } from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { currency } from '../../ui/format';
import { AcademyScout } from './academy-scout';

import { Icon } from '../../ui/icons';
import { PlayerModal } from '../players/player-modal';
import { ClubCustomization } from './club-customization';

import { STADIUM_STYLES, PITCH_STYLES } from '../../three/stadium-styles';

const StadiumScene = lazy(() => import('../../three/stadium-scene'));

const DESCRIPTIONS: Record<string, { title: string; description: string }> = {
  pitch: {
    title: 'Gramado',
    description: 'Mais qualidade no jogo e uma experiência melhor para a torcida.',
  },
  surroundings: {
    title: 'Entorno da arena',
    description: 'Acesso, paisagismo e uma chegada que dá vontade de voltar.',
  },
  structure: {
    title: 'Estrutura do Estádio',
    description:
      'Evolua a arena inteira: novas arquibancadas, anéis, cobertura e fachada em cada nível.',
  },
  food: { title: 'Alimentação', description: 'Aumenta a receita de consumo nos dias de jogo.' },
  shirts: { title: 'Loja do clube', description: 'A paixão vira camisa e receita para o clube.' },
  hospitality: {
    title: 'Camarotes',
    description: 'Uma experiência especial e uma nova fonte de receita.',
  },
  fitness: {
    title: 'Preparação Física',
    description: 'Menos desgaste e recuperação mais rápida entre os jogos.',
  },
  medical: {
    title: 'Departamento Médico',
    description: 'Reduz a chance e o tempo de recuperação de lesões.',
  },
  scouting: {
    title: 'Scout',
    description: 'Aumenta o interesse dos atletas em vestir sua camisa.',
  },
  coaching: {
    title: 'Preparação Técnica',
    description: 'Acelera a evolução das promessas até o potencial.',
  },
  marketing: {
    title: 'Marketing',
    description: 'Amplia a receita recorrente de patrocínio do clube.',
  },
};
const TRAINING_STYLES: Record<string, readonly string[]> = {
  surroundings: [
    'Acesso básico',
    'Entrada organizada',
    'Praça de acesso',
    'Entorno urbanizado',
    'Complexo de acesso à arena',
  ],
  food: [
    'Lanchonete simples',
    'Quiosques de alimentação',
    'Praça de alimentação',
    'Restaurantes da arena',
    'Centro gastronômico',
  ],
  shirts: [
    'Loja simples',
    'Loja equipada',
    'Loja oficial ampliada',
    'Megaloja do clube',
    'Centro comercial do torcedor',
  ],
  hospitality: [
    'Camarote básico',
    'Camarotes equipados',
    'Lounges exclusivos',
    'Camarotes premium',
    'Hospitalidade de elite',
  ],
  fitness: [
    'Academia simples',
    'Academia equipada',
    'Academia e piscina',
    'Complexo esportivo',
    'Centro aquático',
  ],
  medical: [
    'Ambulatório',
    'Clínica do clube',
    'Centro de recuperação',
    'Hospital esportivo',
    'Hospital com heliponto',
  ],
  scouting: [
    'Escritório de observação',
    'Núcleo regional',
    'Rede de observadores',
    'Centro de análise',
    'Central internacional',
  ],
  coaching: [
    'Campo de treino',
    'Dois campos',
    'Campus de treinamento',
    'Pavilhão coberto',
    'Complexo coberto',
  ],
  marketing: [
    'Sala comercial',
    'Sede comercial',
    'Praça dos patrocinadores',
    'Centro de mídia',
    'Pavilhão do torcedor',
  ],
};
type Target =
  | 'pitch'
  | 'surroundings'
  | 'structure'
  | 'food'
  | 'shirts'
  | 'hospitality'
  | 'fitness'
  | 'medical'
  | 'scouting'
  | 'coaching'
  | 'marketing';

function facilityBonuses(target: Target, level: number, sectors: number): string[] {
  const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  switch (target) {
    case 'pitch':
      return [
        `+${level * 2} p.p. de atratividade`,
        `+${fmt(level * 2.5)}% na tolerância ao preço do ingresso`,
      ];
    case 'surroundings':
      return [
        `+${level * 3} p.p. de atratividade`,
        `+${fmt(level * 1.5)}% na tolerância ao preço do ingresso`,
      ];
    case 'structure':
      return [
        `+${level * 2} p.p. de atratividade com todos os setores neste nível`,
        `+${level * 3}% na tolerância ao preço do ingresso`,
        `+${((level - 1) * GAMEPLAY.upgradeCapacity * sectors).toLocaleString('pt-BR')} lugares adicionais`,
      ];
    case 'food':
    case 'shirts':
    case 'hospitality':
      return [
        `Contribuição ao consumo: peso ${fmt(level * (target === 'food' ? 1.5 : target === 'shirts' ? 1 : 4))}`,
        'O efeito depende do público e das demais estruturas comerciais.',
      ];
    case 'scouting': {
      const margin = (6 - level) * 4;
      const potMin = 48 + level * 6;
      return [
        `+${level * GAMEPLAY.interestFacilityWeight} pontos no interesse dos atletas`,
        level === 1
          ? 'Potencial de adversários oculto no mercado'
          : `Relatório de scout: margem de ±${margin} no potencial`,
        `Potencial mínimo dos jovens da base: ${potMin}`,
      ];
    }
    case 'coaching':
      return [
        `Evolução por treino: +${(level - 1) * 100}%`,
        `+${level * GAMEPLAY.interestFacilityWeight} pontos no interesse dos atletas`,
        `Até ${Math.min(3, level)} ciclos individuais simultâneos`,
      ];
    case 'fitness':
      return [
        `${fmt((1 - 1 / (1 + (level - 1) * GAMEPLAY.fitnessFatigueReductionPerLevel)) * 100)}% a menos de desgaste em jogos`,
        `Recuperação base: ${fmt(GAMEPLAY.fitnessRecovery + level * GAMEPLAY.recoveryPerLevel)} por dia, ajustada pela rotina`,
        ...(level >= 3
          ? [
              `${level - 2} ${level === 3 ? 'vaga' : 'vagas'} de atendimento Plus (+50% de recuperação)`,
            ]
          : []),
      ];
    case 'medical':
      return [
        `Risco de lesão: ${fmt((1 - 1 / Math.sqrt(level)) * 100)}% a menos`,
        `Duração das lesões: ${fmt((1 - 1 / level) * 100)}% a menos`,
        ...(level >= 3
          ? [
              `${level - 2} ${level === 3 ? 'vaga' : 'vagas'} de tratamento Plus (recuperação de 2 partidas por jogo)`,
            ]
          : []),
        ...(level === 5 ? ['Seringa e liberação médica disponíveis.'] : []),
      ];
    case 'marketing':
      return MARKETING_BENEFITS.slice(0, level);
  }
}

export function Facilities(props: ViewProps & { training?: boolean }) {
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const fit = () => {
      const bottom = Math.min(
        window.visualViewport?.height ?? window.innerHeight,
        document.querySelector('.mobile-bottom-nav')?.getBoundingClientRect().top ?? Infinity,
      );
      page.style.setProperty(
        '--facility-page-height',
        `${bottom - page.getBoundingClientRect().top - window.scrollY - 8}px`,
      );
    };
    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, []);
  const { stadium, center, club, training = false } = props;
  const [confirmation, setConfirmation] = useState<{ message: string; action: () => void } | null>(
    null,
  );
  const [trainingDraft, setTrainingDraft] = useState<
    Record<string, 'light' | 'moderate' | 'intense'>
  >({});
  const [discardTraining, setDiscardTraining] = useState(false);
  const trainingDirty = Object.entries(trainingDraft).some(
    ([id, load]) => load !== (props.center.operations?.playerLoads?.[id] ?? 'moderate'),
  );
  const closeManagement = () => {
    if (trainingDirty) setDiscardTraining(true);
    else {
      setTrainingDraft({});
      setManaging(null);
    }
  };
  const [managing, setManaging] = useState<string | null>(null);
  const [bonusTarget, setBonusTarget] = useState<Target | null>(null);
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const send = useGameStore((state) => state.send);
  const busy = useGameStore((state) => state.busy);
  const [mobileSector, setMobileSector] = useState('');
  const levels: Array<[Target, number]> = training
    ? (Object.entries(center.levels) as Array<[Target, number]>)
    : [
        ['pitch', stadium.pitchLevel],
        ['surroundings', stadium.surroundingsLevel],
        ['structure', Math.max(...stadium.sectors.map((sector) => sector.level))],
        ['food', stadium.commerce.foodLevel],
        ['shirts', stadium.commerce.shirtsLevel],
        ['hospitality', stadium.commerce.hospitalityLevel],
      ];
  return (
    <div ref={pageRef} className={`facilities-page ${training ? 'training-page' : 'stadium-page'}`}>
      <div className="facility-cash-bar">
        <span className="facility-cash-icon">
          <Icon name="balance" size={22} />
        </span>
        <div>
          <span>Caixa do clube</span>
          <strong>{currency(club.balance.cents)}</strong>
        </div>
      </div>
      <section className="facility-scene panel">
        <Suspense fallback={<div className="scene-loading">Carregando sua estrutura…</div>}>
          <StadiumScene
            key={training ? 'training' : 'stadium'}
            stadium={stadium}
            center={center}
            {...(training
              ? {
                  focus: 'training' as const,
                  onSelectSector: (target: string) => {
                    setManaging(target);
                    if (target === 'scouting')
                      send({ type: 'management', action: 'scout-academy' });
                  },
                }
              : {})}
          />
        </Suspense>
        <div className="scene-legend">
          <span className="live-dot">VISUALIZAÇÃO 3D</span>
          {!training && (
            <>
              <div className="stadium-skin-control">
                <Select
                  aria-label="Skin do Estádio"
                  value={
                    stadium.skin && stadium.sectors.every((s) => s.level >= 4)
                      ? stadium.skin
                      : 'default'
                  }
                  disabled={busy || stadium.sectors.some((s) => s.level < 4)}
                  onValueChange={(value) =>
                    send({
                      type: 'customize',
                      stadiumSkin:
                        value === 'default' ? null : (value as NonNullable<typeof stadium.skin>),
                      stadiumColor: stadium.color ?? '#315d55',
                      centerColor: center.color ?? '#e5dfcf',
                      ...clubKit(club),
                    })
                  }
                >
                  <Option value="default">
                    {linkedStadiumSkin(stadium)
                      ? 'Estádio original do clube'
                      : 'Estrutura genérica · por nível'}
                  </Option>
                  {STADIUM_SKINS.map((s) => (
                    <Option key={s[0]} value={s[0]}>
                      {s[1]}
                    </Option>
                  ))}
                </Select>
                {stadium.sectors.some((s) => s.level < 4) && (
                  <small>Troca de skin liberada no nível 4 de todos os setores.</small>
                )}
              </div>
            </>
          )}
        </div>
      </section>
      <div className="facility-structure-panel">
        <FacilityTabs
          label={training ? 'Estruturas do CT' : 'Estruturas do estádio'}
          value={(levels.some(([id]) => id === mobileSector) ? mobileSector : levels[0]?.[0]) ?? ''}
          onChange={setMobileSector}
          items={levels.map(([target]) => ({
            id: target,
            fullLabel: DESCRIPTIONS[target]?.title ?? target,
            label:
              (
                {
                  fitness: 'Físico',
                  medical: 'Médico',
                  scouting: 'Scout',
                  coaching: 'Técnico',
                  marketing: 'Marketing',
                  pitch: 'Gramado',
                  surroundings: 'Entorno',
                  structure: 'Estrutura',
                  food: 'Alimentação',
                  shirts: 'Loja',
                  hospitality: 'Camarotes',
                } as Record<string, string>
              )[target] ?? target,
            icon:
              SECTORS[target]?.icon ??
              (
                {
                  pitch: 'pitch',
                  surroundings: 'entrance',
                  structure: 'stadium',
                  food: 'food',
                  shirts: 'shirt',
                  hospitality: 'hospitality',
                } as Record<string, string>
              )[target] ??
              'stadium',
          }))}
        />
        <div className="facility-grid">
          {levels.map(([target, level]) => {
            const info = DESCRIPTIONS[target];
            const cost = upgradePrice(level, target);
            const commerce =
              stadium.commerce.foodLevel * 1.5 +
              stadium.commerce.shirtsLevel +
              stadium.commerce.hospitalityLevel * 4;
            const percent = (value: number) =>
              new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(
                Math.floor(value),
              );
            const benefit =
              level >= 5
                ? 'Estrutura no máximo'
                : (
                    {
                      pitch: '+2% de atratividade',
                      surroundings: '+3% de atratividade',
                      structure: '+2% de atratividade',
                      food: `+${percent(150 / commerce)}% na receita de consumo*`,
                      shirts: `+${percent(100 / commerce)}% na receita de consumo*`,
                      hospitality: `+${percent(400 / commerce)}% na receita de consumo*`,
                      scouting: `+${GAMEPLAY.interestFacilityWeight} pontos no interesse dos atletas`,
                      coaching: `+${percent(100 / level)}% na evolução por treino`,
                      medical: `−${percent((1 - Math.sqrt(level / (level + 1))) * 100)}% no risco de lesão em jogos`,
                      fitness: `−${percent((100 * GAMEPLAY.fitnessFatigueReductionPerLevel) / (1 + level * GAMEPLAY.fitnessFatigueReductionPerLevel))}% no desgaste em jogos`,
                      marketing: '+2% na demanda da torcida',
                    } as Record<string, string>
                  )[target];
            return (
              <section
                className={`panel facility-card ${training ? `sector-card sector-${target}` : `stadium-sector stadium-sector-${target}`}`}
                key={target}
                data-mobile-active={
                  (levels.some(([id]) => id === mobileSector) ? mobileSector : levels[0]?.[0]) ===
                  target
                }
              >
                <div className="section-header">
                  <button
                    type="button"
                    className="facility-icon facility-bonus-trigger"
                    aria-label={`Ver bônus de ${info?.title ?? target} por nível`}
                    onClick={() => setBonusTarget(target)}
                  >
                    <Icon
                      name={
                        training
                          ? (SECTORS[target]?.icon ?? 'training')
                          : ((
                              {
                                pitch: 'pitch',
                                surroundings: 'entrance',
                                structure: 'stadium',
                                food: 'food',
                                shirts: 'shirt',
                                hospitality: 'hospitality',
                              } as Record<string, string>
                            )[target] ?? 'stadium')
                      }
                      size={26}
                    />
                  </button>
                  <span className="pill">NÍVEL {level} / 5</span>
                </div>
                <h2>{info?.title}</h2>
                <p>{info?.description}</p>
                {training && <SectorGuide sector={target} />}
                {training && target === 'marketing' && (
                  <p className="sector-benefit">{MARKETING_BENEFITS[level - 1]}</p>
                )}
                {(target === 'structure' || target === 'pitch') && (
                  <div className="upgrade-evolution">
                    <aside className="facility-benefit">
                      <small>Próximo nível</small>
                      <b>{benefit}</b>
                    </aside>
                    <strong>
                      {(target === 'structure' ? STADIUM_STYLES : PITCH_STYLES)[level - 1]}
                    </strong>
                    {level < 5 && (
                      <span>
                        Próximo: {(target === 'structure' ? STADIUM_STYLES : PITCH_STYLES)[level]}
                      </span>
                    )}
                  </div>
                )}
                {TRAINING_STYLES[target] && (
                  <div className="upgrade-evolution">
                    <aside
                      className="facility-benefit"
                      title="Receitas de consumo variam com público, capacidade e arredondamentos; não representam lucro líquido."
                    >
                      <small>{level >= 5 ? 'Benefício' : 'Próximo nível'}</small>
                      <b>{benefit}</b>
                    </aside>
                    <strong>{TRAINING_STYLES[target]?.[level - 1]}</strong>
                    {level < 5 && <span>Próximo: {TRAINING_STYLES[target]?.[level]}</span>}
                  </div>
                )}
                <div className="facility-card-footer">
                  <div className="facility-maintenance-summary">
                    {level < 5 && (
                      <p className="negative">
                        Próximo nível: +
                        {currency(
                          maintenanceForLevel(level + 1, target) -
                            maintenanceForLevel(level, target),
                        )}
                        /mês de manutenção
                      </p>
                    )}
                    <p>Manutenção mensal: {currency(maintenanceForLevel(level, target))}</p>
                  </div>
                  <div className="level-track">
                    {[1, 2, 3, 4, 5].map((step) => (
                      <i key={step} className={step <= level ? 'filled' : ''} />
                    ))}
                  </div>
                  {training && (
                    <button
                      className="sector-manage full"
                      onClick={() => {
                        setManaging(target);
                        if (target === 'scouting')
                          send({ type: 'management', action: 'scout-academy' });
                      }}
                    >
                      Gerenciar <Icon name="arrow" size={17} />
                    </button>
                  )}
                  <div className="facility-actions">
                    <button
                      className="secondary full facility-upgrade"
                      disabled={busy || level >= 5 || club.balance.cents < cost}
                      onClick={() => {
                        setConfirmation({
                          message:
                            'Confirmar upgrade de ' + info?.title + ' por ' + currency(cost) + '?',
                          action: () => send({ type: 'upgrade', target }),
                        });
                      }}
                    >
                      {level >= 5 ? 'Estrutura no máximo' : `Upgrade · ${currency(cost)}`}
                    </button>
                    {level > 1 && (
                      <button
                        className="secondary full"
                        disabled={busy}
                        onClick={() => {
                          setConfirmation({
                            message:
                              'Vender um nível de ' +
                              info?.title +
                              ' por ' +
                              currency(upgradePrice(level - 1, target) * 0.5) +
                              '? A estrutura voltará ao nível ' +
                              (level - 1) +
                              '.',
                            action: () =>
                              send({ type: 'management', action: 'sell-facility', target }),
                          });
                        }}
                      >
                        Vender · {currency(upgradePrice(level - 1, target) * 0.5)}
                      </button>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {bonusTarget && (
        <PlayerModal
          title={DESCRIPTIONS[bonusTarget]!.title + ' · Bônus por nível'}
          className={`facility-bonus-modal sector-${bonusTarget} stadium-sector-${bonusTarget}`}
          onClose={() => setBonusTarget(null)}
        >
          <p>
            Benefícios por nível. Percentuais de evolução, redução e capacidade adicional comparados
            ao nível 1.
          </p>
          <div className="facility-bonus-grid">
            {[1, 2, 3, 4, 5].map((tier) => {
              const current = levels.find(([target]) => target === bonusTarget)?.[1] ?? 0;
              return (
                <section
                  key={tier}
                  className="facility-bonus-level"
                  data-locked={tier > current}
                  data-current={tier === current}
                >
                  <header>
                    <strong>Nível {tier}</strong>
                    <span>
                      {tier > current
                        ? '🔒 Não adquirido'
                        : tier === current
                          ? '✓ Atual'
                          : '✓ Adquirido'}
                    </span>
                  </header>
                  <b>
                    {
                      (bonusTarget === 'structure'
                        ? STADIUM_STYLES
                        : bonusTarget === 'pitch'
                          ? PITCH_STYLES
                          : TRAINING_STYLES[bonusTarget])?.[tier - 1]
                    }
                  </b>
                  <ul>
                    {facilityBonuses(bonusTarget, tier, stadium.sectors.length).map((bonus) => (
                      <li key={bonus}>{bonus}</li>
                    ))}
                  </ul>
                  <small>Manutenção: {currency(maintenanceForLevel(tier, bonusTarget))}/mês</small>
                </section>
              );
            })}
          </div>
        </PlayerModal>
      )}
      {confirmation && (
        <PlayerModal
          title="Decisão da diretoria"
          className="facility-confirmation"
          onClose={() => setConfirmation(null)}
        >
          <div className="facility-confirmation-emblem">
            <Icon name="stadium" size={42} />
          </div>
          <span className="eyebrow">O FUTURO DO CLUBE COMEÇA AQUI</span>
          <h3>Planejamento de campeão</h3>
          <p>{confirmation.message}</p>
          <div className="facility-actions">
            <button className="secondary full" autoFocus onClick={() => setConfirmation(null)}>
              Voltar ao planejamento
            </button>
            <button
              className="full"
              disabled={busy}
              onClick={() => {
                confirmation.action();
                setConfirmation(null);
              }}
            >
              Confirmar decisão <Icon name="arrow" />
            </button>
          </div>
        </PlayerModal>
      )}
      {discardTraining && (
        <PlayerModal
          className="discard-training-confirm"
          title="Treino não salvo"
          onClose={() => setDiscardTraining(false)}
        >
          <p>
            Você alterou as cargas de treino e ainda não salvou. Deseja sair e descartar as
            alterações?
          </p>
          <div className="career-confirm-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                const request = send({
                  type: 'management',
                  action: 'center',
                  target: 'save-training',
                  playerLoads: trainingDraft,
                });
                if (request) setDiscardTraining(false);
              }}
            >
              {busy ? 'Salvando…' : 'Salvar treino'}
            </button>
            <button
              className="career-confirm-danger"
              onClick={() => {
                setTrainingDraft({});
                setDiscardTraining(false);
                setManaging(null);
              }}
            >
              Descartar e sair
            </button>
          </div>
        </PlayerModal>
      )}
      {training && managing && (
        <PlayerModal
          title={DESCRIPTIONS[managing]?.title ?? 'Gerenciar setor'}
          onClose={closeManagement}
          className={`center-management-modal ${managing === 'coaching' ? 'individual-coaching-modal' : ''} ${managing === 'fitness' || managing === 'medical' || managing === 'coaching' ? 'fitness-management-modal' : ''}`}
        >
          {managing === 'scouting' ? (
            <AcademyScout {...props} />
          ) : (
            <CenterManagement
              {...props}
              sector={managing}
              trainingDraft={trainingDraft}
              onTrainingChange={(id, load) =>
                setTrainingDraft((previous) => ({ ...previous, [id]: load }))
              }
              onCustomize={() => {
                setManaging(null);
                setCustomizationOpen(true);
              }}
            />
          )}
        </PlayerModal>
      )}
      {customizationOpen && (
        <PlayerModal
          className="club-customization-modal"
          title="Personalização do clube"
          onClose={() => setCustomizationOpen(false)}
        >
          <ClubCustomization {...props} />
        </PlayerModal>
      )}
    </div>
  );
}
