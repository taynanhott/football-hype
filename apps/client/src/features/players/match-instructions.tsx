import { markNotificationsSeen } from '../../ui/use-navigation-notifications';
import { useState } from 'react';
import {
  clubKit,
  FORMATION_LABELS,
  formationSchema,
  playStyleSchema,
  type MatchInstructions,
  type WorldState,
  type ClubSnapshot,
} from '@football/shared';
import { STYLE_LABELS } from '@football/domain';
import { clubAvailabilityReturns, clubUnavailablePlayers } from './player-availability';
import { Select, Option } from '../../ui/select';
import { PlayerModal } from './player-modal';
import { Portrait } from './pixel-portrait';
import { positionLabel } from '../../ui/position-label';
import { Icon } from '../../ui/icons';
import { FormationIcon } from './formation-icon';
import { PLAY_STYLE_ICONS } from './play-style-icons';

const triggers = [
  ['winning-two', '↑ Se estiver vencendo por 2+'],
  ['losing-60', '◷ Se estiver perdendo após 60′'],
  ['drawing-75', '◷ Se estiver empatando após 75′'],
] as const;
const times = [60, 70, 80, 'fatigue'] as const;
const scores = {
  always: 'Sempre',
  winning: 'Se vencendo',
  drawing: 'Se empatando',
  losing: 'Se perdendo',
} as const;
export function UnavailablePlayers({ state, club }: { state: WorldState; club: ClubSnapshot }) {
  const unavailable = clubUnavailablePlayers(state, club);
  const returns = clubAvailabilityReturns(state, club);
  return (
    <details
      className="match-instructions unavailable-players"
      onToggle={(event) => {
        if (event.currentTarget.open) markNotificationsSeen(state, club.id, 'unavailable');
      }}
    >
      <summary>
        <span>
          <Icon name="recovery" size={16} /> Indisponíveis
        </span>
        <small className="unavailable-count">
          {unavailable.length} {unavailable.length === 1 ? 'atleta' : 'atletas'}
        </small>
        <span className="reserve-toggle" aria-hidden="true">
          <Icon name="chevron-down" size={16} />
        </span>
      </summary>
      {unavailable.length ? (
        unavailable.map((p) => {
          const forecast = returns.get(p.id);
          return (
            <div className="unavailable-player-card" key={p.id}>
              <span className="unavailable-player-portrait">
                <Portrait player={p} clubName={club.name} kit={clubKit(club)} />
              </span>
              <span className="unavailable-player-info">
                <strong>{p.name}</strong>
                <small>
                  {positionLabel(p.position)} ·{' '}
                  {forecast?.injured && (
                    <span className="unavailable-reason">
                      <Icon name="recovery" size={12} /> Lesionado
                    </span>
                  )}
                  {forecast?.calledUp && (
                    <span className="unavailable-reason">
                      <Icon name="flag" size={12} /> Convocado
                    </span>
                  )}
                </small>
                {forecast && (
                  <>
                    <span className="unavailable-player-games">
                      {forecast.games
                        ? `Faltam ${forecast.games} ${forecast.games === 1 ? 'jogo' : 'jogos'} para voltar`
                        : 'Volta antes do próximo jogo'}
                    </span>
                    {forecast.at !== null && (
                      <small>
                        Retorno {forecast.injured ? 'previsto ' : ''}
                        {new Date(forecast.at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          timeZone: 'America/Sao_Paulo',
                        })}
                      </small>
                    )}
                  </>
                )}
              </span>
              <span
                className="unavailable-player-overall market-overall-badge"
                data-tier={
                  p.overall <= 69
                    ? 'bronze'
                    : p.overall <= 77
                      ? 'silver'
                      : p.overall <= 85
                        ? 'gold'
                        : 'diamond'
                }
                aria-label={`Overall ${p.overall}`}
              >
                <strong>{p.overall}</strong>
              </span>
            </div>
          );
        })
      ) : (
        <p className="unavailable-empty">
          <Icon name="shield" size={18} />
          <span>Todo o elenco está disponível.</span>
        </p>
      )}
    </details>
  );
}

function abbreviatedPlayerName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return (
    parts
      .slice(0, -1)
      .map((part) => part[0] + '.')
      .join(' ') +
    ' ' +
    parts[parts.length - 1]
  );
}

type Plan = MatchInstructions['substitutions'][number];
export function MatchInstructionsEditor({
  state,
  club,
  starters,
  reserves,
  value,
  onChange,
}: {
  state: WorldState;
  club: ClubSnapshot;
  starters: string[];
  reserves: string[];
  value: MatchInstructions;
  onChange: (value: MatchInstructions) => void;
}) {
  const [draft, setDraft] = useState<Partial<Plan> | null>(null);
  const [protect, setProtect] = useState(false);
  const unavailable = clubUnavailablePlayers(state, club);
  const playerList = (ids: string[], choose: (id: string) => void) => (
    <div className="bench-list">
      {ids.flatMap((id) => {
        const p = state.players.byId[id];
        return p
          ? [
              <button
                type="button"
                className={`bench-player ${starters.includes(id) ? 'starter' : ''}`}
                key={id}
                onClick={() => choose(id)}
                disabled={unavailable.some((p) => p.id === id)}
              >
                <Portrait player={p} clubName={club.name} kit={clubKit(club)} />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {positionLabel(p.position)} · OVR {p.overall} · Condição {p.fitness}%
                  </small>
                </span>
                <b>
                  <Icon name="arrow" size={14} />
                  Escolher
                </b>
              </button>,
            ]
          : [];
      })}
    </div>
  );
  return (
    <>
      <section className="match-instructions" aria-label="Durante o jogo">
        <h3>⚑ Durante o jogo</h3>
        {triggers.map(([trigger, label]) => {
          const rule = value.situations.find((r) => r.trigger === trigger);
          const change = (patch: Partial<MatchInstructions['situations'][number]>) =>
            onChange({
              ...value,
              situations: [
                ...value.situations.filter((r) => r.trigger !== trigger),
                { ...rule, trigger, ...patch },
              ],
            });
          return (
            <div className={`match-situation situation-${trigger}`} key={trigger}>
              <strong>{label}</strong>
              <div className="match-situation-controls">
                <label>
                  <Select
                    className={`match-situation-select ${!rule?.style ? 'unchanged-choice' : ''}`}
                    menuMinWidth={240}
                    aria-label={`Estilo: ${label}`}
                    value={rule?.style ?? ''}
                    onValueChange={(style) =>
                      change({ style: style ? playStyleSchema.parse(style) : undefined })
                    }
                  >
                    <Option value="">
                      <span className="match-option-content">
                        <Icon name="block" size={16} />
                        <span>Não muda</span>
                      </span>
                    </Option>
                    {playStyleSchema.options.map((s) => (
                      <Option key={s} value={s}>
                        <span className={`match-option-content play-style-option play-style-${s}`}>
                          <Icon name={PLAY_STYLE_ICONS[s]} size={18} />
                          <span>{STYLE_LABELS[s]}</span>
                        </span>
                      </Option>
                    ))}
                  </Select>
                </label>
                <label>
                  <Select
                    className={`match-situation-select ${!rule?.formation ? 'unchanged-choice' : ''}`}
                    menuMinWidth={240}
                    aria-label={`Formação: ${label}`}
                    value={rule?.formation ?? ''}
                    onValueChange={(formation) =>
                      change({
                        formation: formation ? formationSchema.parse(formation) : undefined,
                      })
                    }
                  >
                    <Option value="">
                      <span className="match-option-content">
                        <Icon name="block" size={16} />
                        <span>Não muda</span>
                      </span>
                    </Option>
                    {formationSchema.options.map((f) => (
                      <Option key={f} value={f}>
                        <span className="match-option-content">
                          <FormationIcon formation={f} />
                          <span>{FORMATION_LABELS[f]}</span>
                        </span>
                      </Option>
                    ))}
                  </Select>
                </label>
              </div>
            </div>
          );
        })}
        <div className="planned-heading">
          <strong>⇄ Trocas planejadas · {value.substitutions.length}/3</strong>
          <button
            type="button"
            disabled={value.substitutions.length >= 3 || !reserves.length || draft !== null}
            onClick={() => {
              setDraft({ when: 60, score: 'always' });
            }}
          >
            + Planejar
          </button>
        </div>
        <div className="planned-inline-slots">
          {Array.from({ length: 3 }, (_, i) => {
            const saved = value.substitutions[i];
            const editing = !saved && i === value.substitutions.length && draft !== null;
            const plan: Partial<Plan> | undefined = saved ?? (editing ? draft! : undefined);
            if (!plan) return null;
            const update = (patch: Partial<Plan>) => {
              const next = {
                ...plan,
                when: plan.when === 90 ? (80 as const) : (plan.when ?? 60),
                ...patch,
              };
              if (saved)
                onChange({
                  ...value,
                  substitutions: value.substitutions.map((p, index) =>
                    index === i ? (next as Plan) : p,
                  ),
                });
              else if (next.out && next.in && next.when && next.score) {
                onChange({ ...value, substitutions: [...value.substitutions, next as Plan] });
                setDraft(null);
              } else setDraft(next);
            };
            const options = (ids: string[], field: 'out' | 'in') =>
              ids
                .filter(
                  (id) =>
                    !value.protected.includes(id) &&
                    !value.substitutions.some((p, index) => index !== i && p[field] === id),
                )
                .flatMap((id) => {
                  const player = state.players.byId[id];
                  return player
                    ? [
                        <Option key={id} value={id} disabled={unavailable.some((p) => p.id === id)}>
                          <span className="planned-player-option">
                            <b
                              className="planned-option-overall market-overall-badge"
                              data-tier={
                                player.overall <= 69
                                  ? 'bronze'
                                  : player.overall <= 77
                                    ? 'silver'
                                    : player.overall <= 85
                                      ? 'gold'
                                      : 'diamond'
                              }
                              aria-label={`Overall ${player.overall}`}
                            >
                              {player.overall}
                            </b>
                            <Portrait player={player} clubName={club.name} kit={clubKit(club)} />
                            <span>
                              <strong className="planned-player-full-name">{player.name}</strong>
                              <strong className="planned-player-short-name" title={player.name}>
                                {abbreviatedPlayerName(player.name)}
                              </strong>
                              <small>
                                {positionLabel(player.position)} · Condição {player.fitness}%
                              </small>
                            </span>
                          </span>
                        </Option>,
                      ]
                    : [];
                });
            return (
              <div className="planned-inline-row" key={i}>
                <div className="planned-inline-settings">
                  <Select
                    value={plan.when === 90 ? 80 : (plan.when ?? 60)}
                    aria-label={`Quando trocar · troca ${i + 1}`}
                    onValueChange={(when) =>
                      update({
                        when: when === 'fatigue' ? 'fatigue' : (Number(when) as Plan['when']),
                      })
                    }
                  >
                    {times.map((when) => (
                      <Option key={when} value={when}>
                        {when === 'fatigue' ? 'Por cansaço' : `Aos ${when}′`}
                      </Option>
                    ))}
                  </Select>
                  <Select
                    className="planned-score-select"
                    menuMinWidth={190}
                    value={plan.score ?? 'always'}
                    aria-label={`Condição do placar · troca ${i + 1}`}
                    onValueChange={(score) => update({ score: score as Plan['score'] })}
                  >
                    {(Object.keys(scores) as Plan['score'][]).map((score) => (
                      <Option key={score} value={score}>
                        {scores[score]}
                      </Option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    className="planned-inline-remove"
                    aria-label={`Remover troca ${i + 1}`}
                    onClick={() =>
                      saved
                        ? onChange({
                            ...value,
                            substitutions: value.substitutions.filter((_, index) => index !== i),
                          })
                        : setDraft(null)
                    }
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
                <div className="planned-inline-players">
                  <label className="planned-inline-out">
                    <span>Sai</span>
                    <Select
                      className="planned-player-select"
                      menuMinWidth={280}
                      aria-label={`Jogador que sai · troca ${i + 1}`}
                      value={plan.out ?? ''}
                      onValueChange={(out) => update({ out })}
                    >
                      <Option value="" disabled>
                        Escolher jogador
                      </Option>
                      {options(starters, 'out')}
                    </Select>
                  </label>
                  <Icon name="market" size={16} />
                  <label className="planned-inline-in">
                    <span>Entra</span>
                    <Select
                      className="planned-player-select"
                      menuMinWidth={280}
                      aria-label={`Jogador que entra · troca ${i + 1}`}
                      value={plan.in ?? ''}
                      onValueChange={(incoming) => update({ in: incoming })}
                    >
                      <Option value="" disabled>
                        Escolher jogador
                      </Option>
                      {options(reserves, 'in')}
                    </Select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        <div className="protected-players">
          <button
            type="button"
            aria-label={`Não substituir · ${value.protected.length}/2`}
            disabled={value.protected.length >= 2}
            onClick={() => setProtect(true)}
          >
            <span className="protected-button-label">Não substituir</span>
            <small className="protected-button-detail">
              <Icon name="shield" size={12} />
              {value.protected.length}/2
            </small>
          </button>
          {Array.from({ length: 2 }, (_, index) => {
            const id = value.protected[index];
            if (!id)
              return (
                <button
                  type="button"
                  className="protected-slot-empty"
                  key={index}
                  aria-label={`Escolher jogador para não substituir no espaço ${index + 1}`}
                  onClick={() => setProtect(true)}
                >
                  <Icon name="shield" size={16} />
                  <span className="protected-button-label">Vazio</span>
                </button>
              );
            return (
              <button
                type="button"
                key={id}
                title={state.players.byId[id]?.name}
                aria-label={`Remover proteção de ${state.players.byId[id]?.name}`}
                onClick={() =>
                  onChange({ ...value, protected: value.protected.filter((p) => p !== id) })
                }
              >
                <span className="protected-button-label">{state.players.byId[id]?.name}</span>
                <small className="protected-button-detail">
                  <Icon name="trash" size={11} />
                  Remover
                </small>
              </button>
            );
          })}
        </div>
      </section>
      {protect && (
        <PlayerModal
          title="Não substituir"
          className="lineup-selection-modal match-plan-modal"
          onClose={() => setProtect(false)}
        >
          <p>Proteja até dois titulares. Eles ficam fora das trocas automáticas e planejadas.</p>
          {playerList(
            starters.filter(
              (id) =>
                !value.protected.includes(id) &&
                !value.substitutions.some((plan) => plan.out === id),
            ),
            (id) => {
              if (value.protected.length < 2)
                onChange({ ...value, protected: [...value.protected, id] });
              setProtect(false);
            },
          )}
        </PlayerModal>
      )}
    </>
  );
}
