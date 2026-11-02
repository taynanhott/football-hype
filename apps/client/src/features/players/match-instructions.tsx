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
import { STYLE_LABELS, medicallyAvailable, isFifaWindow } from '@football/domain';
import { Select, Option } from '../../ui/select';
import { PlayerModal } from './player-modal';
import { Portrait } from './pixel-portrait';
import { positionLabel } from '../../ui/position-label';
import { Icon } from '../../ui/icons';
import { FormationIcon } from './formation-icon';
import { PLAY_STYLE_ICONS } from './play-style-picker';

const triggers = [
  ['winning-two', '↑ Se estiver vencendo por 2+'],
  ['losing-60', '◷ Se estiver perdendo após 60′'],
  ['drawing-75', '◷ Se estiver empatando após 75′'],
] as const;
const times = [60, 70, 80, 90, 'fatigue'] as const;
const scores = {
  always: 'Sempre',
  winning: 'Se vencendo',
  drawing: 'Se empatando',
  losing: 'Se perdendo',
} as const;
export function UnavailablePlayers({ state, club }: { state: WorldState; club: ClubSnapshot }) {
  const unavailable = club.playerIds.flatMap((id) => {
    const p = state.players.byId[id];
    return p &&
      (!medicallyAvailable(state, id) || (isFifaWindow(state.nextScheduledAt) && p.overall >= 80))
      ? [p]
      : [];
  });
  if (!unavailable.length)
    return (
      <section className="match-instructions unavailable-players" aria-label="Indisponíveis">
        <h3>✚ Indisponíveis · 0</h3>
        <p className="unavailable-empty">
          <Icon name="shield" size={18} />
          <span>Todo o elenco está disponível.</span>
        </p>
      </section>
    );
  return (
    <details className="match-instructions unavailable-players">
      <summary>✚ Indisponíveis · {unavailable.length}</summary>
      {unavailable.length ? (
        unavailable.map((p) => (
          <div className="bench-player" key={p.id}>
            <Portrait player={p} />
            <span>
              <strong>{p.name}</strong>
              <small>
                {positionLabel(p.position)} ·{' '}
                {state.injuries[p.id]
                  ? `Lesionado · ${state.injuries[p.id]} dias`
                  : 'Seleção nacional'}
              </small>
            </span>
            <b>{p.overall}</b>
          </div>
        ))
      ) : (
        <p>Todo o elenco está disponível.</p>
      )}
    </details>
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
  const [step, setStep] = useState<'out' | 'in' | 'when' | 'score'>('out');
  const [protect, setProtect] = useState(false);
  const unavailable = club.playerIds.flatMap((id) => {
    const p = state.players.byId[id];
    return p &&
      (!medicallyAvailable(state, id) || (isFifaWindow(state.nextScheduledAt) && p.overall >= 80))
      ? [p]
      : [];
  });
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
                  Estilo
                  <Select
                    className="match-situation-select"
                    menuMinWidth={240}
                    aria-label={`Estilo: ${label}`}
                    value={rule?.style ?? ''}
                    onValueChange={(style) =>
                      change({ style: style ? playStyleSchema.parse(style) : undefined })
                    }
                  >
                    <Option value="">Não muda</Option>
                    {playStyleSchema.options.map((s) => (
                      <Option key={s} value={s}>
                        <span className="match-option-content">
                          <Icon name={PLAY_STYLE_ICONS[s]} size={18} />
                          <span>{STYLE_LABELS[s]}</span>
                        </span>
                      </Option>
                    ))}
                  </Select>
                </label>
                <label>
                  Formação
                  <Select
                    className="match-situation-select"
                    menuMinWidth={240}
                    aria-label={`Formação: ${label}`}
                    value={rule?.formation ?? ''}
                    onValueChange={(formation) =>
                      change({
                        formation: formation ? formationSchema.parse(formation) : undefined,
                      })
                    }
                  >
                    <Option value="">Não muda</Option>
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
            disabled={value.substitutions.length >= 3 || !reserves.length}
            onClick={() => {
              setDraft({});
              setStep('out');
            }}
          >
            + Planejar
          </button>
        </div>
        <p className="match-plan-hint">
          Até 5 trocas no total. Automáticas por condição abaixo de 30 ou nota abaixo de 5,8, a
          partir dos 60′.
        </p>
        {value.substitutions.map((p, i) => (
          <div className="planned-swap" key={p.out}>
            <div className="planned-swap-info">
              <div className="planned-swap-players">
                <span className="planned-player-out">
                  <small>Sai</small>
                  <strong>{state.players.byId[p.out]?.name}</strong>
                </span>
                <span className="planned-player-in">
                  <small>Entra</small>
                  <strong>{state.players.byId[p.in]?.name}</strong>
                </span>
              </div>
              <small>
                {p.when === 'fatigue' ? "Por cansaço, após 60'" : `Aos ${p.when}′`} ·{' '}
                {scores[p.score]}
              </small>
            </div>
            <button
              type="button"
              className="planned-delete"
              aria-label={`Remover troca ${i + 1}`}
              onClick={() =>
                onChange({
                  ...value,
                  substitutions: value.substitutions.filter((_, index) => index !== i),
                })
              }
            >
              <Icon name="trash" size={16} />
              <span>Excluir</span>
            </button>
          </div>
        ))}
        <div className="protected-players">
          <button
            type="button"
            aria-label={`Não substituir · ${value.protected.length}/2`}
            onClick={() => setProtect(true)}
          >
            <span className="protected-button-label">Não substituir</span>
            <small className="protected-button-detail">
              <Icon name="shield" size={12} />
              {value.protected.length}/2
            </small>
          </button>
          {value.protected.map((id) => (
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
          ))}
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
      {draft && (
        <PlayerModal
          className="lineup-selection-modal match-plan-modal"
          title={
            step === 'out'
              ? 'Quem sai'
              : step === 'in'
                ? 'Quem entra'
                : step === 'when'
                  ? 'Quando trocar'
                  : 'Condição do placar'
          }
          onClose={() => setDraft(null)}
        >
          {step === 'out' &&
            playerList(
              starters.filter(
                (id) =>
                  !value.protected.includes(id) && !value.substitutions.some((p) => p.out === id),
              ),
              (out) => {
                setDraft({ ...draft, out });
                setStep('in');
              },
            )}
          {step === 'in' &&
            playerList(
              reserves.filter((id) => !value.substitutions.some((p) => p.in === id)),
              (incoming) => {
                setDraft({ ...draft, in: incoming });
                setStep('when');
              },
            )}
          {step === 'when' && (
            <div className="match-plan-options">
              {times.map((when) => (
                <button
                  type="button"
                  key={when}
                  onClick={() => {
                    setDraft({ ...draft, when });
                    setStep('score');
                  }}
                >
                  {when === 'fatigue' ? "Por cansaço, após 60'" : `Aos ${when}′`}
                </button>
              ))}
            </div>
          )}
          {step === 'score' && (
            <div className="match-plan-options">
              {(Object.keys(scores) as Plan['score'][]).map((score) => (
                <button
                  type="button"
                  key={score}
                  onClick={() => {
                    onChange({
                      ...value,
                      substitutions: [...value.substitutions, { ...draft, score } as Plan],
                    });
                    setDraft(null);
                  }}
                >
                  {scores[score]}
                </button>
              ))}
            </div>
          )}
          {step !== 'out' && (
            <button
              type="button"
              className="match-plan-step-back"
              onClick={() => setStep(step === 'in' ? 'out' : step === 'when' ? 'in' : 'when')}
            >
              ← Etapa anterior
            </button>
          )}
        </PlayerModal>
      )}
    </>
  );
}
