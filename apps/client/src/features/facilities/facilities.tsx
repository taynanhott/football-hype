import { SECTORS, MARKETING_BENEFITS } from './center-sectors';
import { CenterManagement, SectorGuide } from './center-management';
import { lazy, Suspense, useState } from 'react';
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
export function Facilities(props: ViewProps & { training?: boolean }) {
  const { stadium, center, club, training = false } = props;
  const [confirmation, setConfirmation] = useState<{ message: string; action: () => void } | null>(
    null,
  );
  const [managing, setManaging] = useState<string | null>(null);
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const send = useGameStore((state) => state.send);
  const busy = useGameStore((state) => state.busy);
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
    <>
      <div className="page-heading">
        <span className="budget-pill">Caixa {currency(club.balance.cents)}</span>
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
          <span>Arraste para explorar · Role para aproximar</span>
        </div>
      </section>
      <div className="facility-grid">
        {levels.map(([target, level]) => {
          const info = DESCRIPTIONS[target];
          const cost = upgradePrice(level, target);
          return (
            <section
              className={`panel facility-card ${training ? `sector-card sector-${target}` : `stadium-sector stadium-sector-${target}`}`}
              key={target}
            >
              <div className="section-header">
                <span className="facility-icon">
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
                </span>
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
              {training && (
                <div className="upgrade-evolution">
                  <strong>{TRAINING_STYLES[target]?.[level - 1]}</strong>
                  {level < 5 && <span>Próximo: {TRAINING_STYLES[target]?.[level]}</span>}
                </div>
              )}
              <div className="facility-card-footer">
                {level < 5 && (
                  <p className="negative">
                    Próximo nível: +
                    {currency(
                      maintenanceForLevel(level + 1, target) - maintenanceForLevel(level, target),
                    )}
                    /mês de manutenção
                  </p>
                )}
                <p>Manutenção mensal: {currency(maintenanceForLevel(level, target))}</p>
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
                    {level < 5 && <Icon name="arrow" />}
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
                      Vender um nível · {currency(upgradePrice(level - 1, target) * 0.5)}
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
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
      {training && managing && (
        <PlayerModal
          title={DESCRIPTIONS[managing]?.title ?? 'Gerenciar setor'}
          onClose={() => setManaging(null)}
          className={`center-management-modal ${managing === 'fitness' || managing === 'medical' || managing === 'coaching' ? 'fitness-management-modal' : ''}`}
        >
          {managing === 'scouting' ? (
            <AcademyScout {...props} />
          ) : (
            <CenterManagement
              {...props}
              sector={managing}
              onCustomize={() => {
                setManaging(null);
                setCustomizationOpen(true);
              }}
            />
          )}
        </PlayerModal>
      )}
      {training && customizationOpen && (
        <PlayerModal
          className="club-customization-modal"
          title="Personalização do clube"
          onClose={() => setCustomizationOpen(false)}
        >
          <ClubCustomization {...props} />
        </PlayerModal>
      )}
    </>
  );
}
