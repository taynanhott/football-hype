import { MatchInstructionsEditor, UnavailablePlayers } from './match-instructions';
import { FormationIcon } from './formation-icon';
import { showDraggedCard, startCardPointerDrag } from '../../ui/card-drag';
import { SquadAverages } from './squad-averages';
import { PlayStylePicker } from './play-style-picker';
import { TacticalAnalysis } from './tactical-analysis';
import { positionLabel } from '../../ui/position-label';
import { Select, Option } from '../../ui/select';
import { PlayerCard } from './player-card';
import { Overall } from './overall';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  GAMEPLAY,
  clubKit,
  formationSchema,
  FORMATION_LINKS,
  FORMATION_LABELS,
  type PlayStyle,
  type Formation,
  type Lineup,
  type MatchInstructions,
} from '@football/shared';
import {
  medicallyAvailable,
  resolveLineup,
  resolveBench,
  injuryProbability,
  learnedPositionFactor,
  effectiveOverall,
  temporaryModifiers,
} from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { Portrait } from './pixel-portrait';
import { PlayerModal } from './player-modal';
import { LineupPresets } from './lineup-presets';
import { MatchBench } from './match-bench';
import { layoutLineupCards } from './lineup-card-layout';
import { cardPlayerName } from './card-player-name';
import { clubAvailabilityAt } from './player-availability';

const mobileLineupQuery = '(max-width: 760px)';
const mobileLineupSnapshot = () => window.matchMedia(mobileLineupQuery).matches;
const subscribeMobileLineup = (change: () => void) => {
  const media = window.matchMedia(mobileLineupQuery);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};
const emptyInstructions: MatchInstructions = { substitutions: [], protected: [], situations: [] };

export function LineupEditor({ snapshot, club, center }: ViewProps) {
  const mobile = useSyncExternalStore(subscribeMobileLineup, mobileLineupSnapshot, () => false);
  const pitchRef = useRef<HTMLDivElement>(null);
  const [pitchSize, setPitchSize] = useState({
    width: 300,
    height: 480,
    cardWidth: 61.2,
    cardHeight: 93.6,
  });
  useEffect(() => {
    const pitch = pitchRef.current;
    if (!pitch) return;
    const measure = () => {
      const card = pitch.querySelector('.tactics-player')?.getBoundingClientRect();
      if (!card) return;
      setPitchSize({
        width: pitch.clientWidth,
        height: pitch.clientHeight,
        cardWidth: card.width,
        cardHeight: card.height,
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(pitch);
    measure();
    return () => observer.disconnect();
  }, []);
  const state = snapshot.state;
  const availabilityAt = clubAvailabilityAt(state, club);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [formation, setFormation] = useState<Formation>(
    state.tactics[club.id]?.formation ?? '4-3-3',
  );
  const [style, setStyle] = useState<PlayStyle>(state.tactics[club.id]?.style ?? 'balanced');
  const [starters, setStarters] = useState<string[]>(state.tactics[club.id]?.starters ?? []);
  const [bench, setBench] = useState<string[]>(() =>
    resolveBench(
      state,
      club,
      availabilityAt,
      resolveLineup(state, club, availabilityAt).flatMap((entry) =>
        entry.player ? [entry.player.id] : [],
      ),
    ),
  );
  const [instructions, setInstructions] = useState<MatchInstructions>(
    state.tactics[club.id]?.instructions ?? emptyInstructions,
  );
  const [selected, setSelected] = useState(0);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    let active = false;
    let pointerY = 0;
    let frame = 0;
    let scrollTarget: HTMLElement | null = null;
    const tick = () => {
      if (!active) return;
      const bounds = scrollTarget?.getBoundingClientRect();
      const top = Math.max(0, bounds?.top ?? 0);
      const bottom = Math.min(window.innerHeight, bounds?.bottom ?? window.innerHeight);
      const edge = Math.min(90, (bottom - top) / 3);
      const speed =
        pointerY < top + edge
          ? -Math.min(18, (top + edge - pointerY) / 4)
          : pointerY > bottom - edge
            ? Math.min(18, (pointerY - bottom + edge) / 4)
            : 0;
      if (scrollTarget) scrollTarget.scrollTop += speed;
      else window.scrollBy(0, speed);
      frame = requestAnimationFrame(tick);
    };
    const start = (event: DragEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.lineup-editor')) return;
      active = true;
      pointerY = event.clientY;
      frame = requestAnimationFrame(tick);
    };
    const over = (event: DragEvent) => {
      pointerY = event.clientY;
      scrollTarget = null;
      let element = event.target instanceof Element ? event.target : null;
      while (element && element !== document.body) {
        if (
          element instanceof HTMLElement &&
          element.scrollHeight > element.clientHeight &&
          /auto|scroll/.test(getComputedStyle(element).overflowY)
        ) {
          scrollTarget = element;
          break;
        }
        element = element.parentElement;
      }
    };
    const stop = () => {
      active = false;
      cancelAnimationFrame(frame);
    };
    const wheel = (event: WheelEvent) => {
      if (!active) return;
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (scrollTarget) scrollTarget.scrollTop += delta;
      else window.scrollBy(0, delta);
    };
    document.addEventListener('dragstart', start);
    document.addEventListener('dragover', over);
    document.addEventListener('dragend', stop);
    document.addEventListener('drop', stop);
    window.addEventListener('blur', stop);
    document.addEventListener('wheel', wheel, { passive: false });
    return () => {
      stop();
      document.removeEventListener('dragstart', start);
      document.removeEventListener('dragover', over);
      document.removeEventListener('dragend', stop);
      document.removeEventListener('drop', stop);
      window.removeEventListener('blur', stop);
      document.removeEventListener('wheel', wheel);
    };
  }, []);
  const [dirty, setDirty] = useState(!state.tactics[club.id]?.bench?.length);
  const send = useGameStore((store) => store.send);
  const busy = useGameStore((store) => store.busy);
  const error = useGameStore((store) => store.error);
  const connected = useGameStore((store) => store.connected);
  const lastAttempt = useRef('');
  const resolvedEntries = resolveLineup(
    state,
    club,
    availabilityAt,
    state.players.byId,
    formation,
    starters,
    style,
  );
  const fieldHeight = 620;
  const entries = layoutLineupCards(
    resolvedEntries,
    pitchSize.width,
    pitchSize.height,
    pitchSize.cardWidth,
    pitchSize.cardHeight,
    formation,
  );
  const pitchTop = 3;
  const pitchBottom = 97;
  const pitchMiddle = (pitchTop + pitchBottom) / 2;
  const penaltyDepth = (pitchBottom - pitchTop) * 0.18;
  const fitnessOverall = (overall: number, fitness: number) => {
    const fatigue = 100 - Math.min(100, Math.max(0, fitness));
    const penalty = Math.round((overall * fatigue) / (GAMEPLAY.fitnessScale * 2));
    return Math.max(1, overall - penalty);
  };
  const ids = entries.flatMap((entry) => (entry.player ? [entry.player.id] : []));
  const reserves = resolveBench(state, club, availabilityAt, ids, bench);
  const activeInstructions = {
    ...instructions,
    substitutions: instructions.substitutions.filter(
      (p) =>
        ids.includes(p.out) && reserves.includes(p.in) && !instructions.protected.includes(p.out),
    ),
    protected: instructions.protected.filter((id) => ids.includes(id)),
  };
  const draftKey = JSON.stringify({
    formation,
    starters: ids,
    style,
    bench: reserves,
    instructions: activeInstructions,
  });
  const saved = state.tactics[club.id];
  const savedKey = saved
    ? JSON.stringify({
        formation: saved.formation,
        starters: saved.starters,
        style: saved.style ?? 'balanced',
        bench: saved.bench ?? [],
        instructions: saved.instructions ?? emptyInstructions,
      })
    : '';
  const pending = dirty && draftKey !== savedKey;
  useEffect(() => {
    if (
      !pending ||
      busy ||
      !connected ||
      error ||
      ids.length !== 11 ||
      lastAttempt.current === draftKey
    )
      return;
    const timer = setTimeout(() => {
      lastAttempt.current = draftKey;
      send({ type: 'lineup', ...(JSON.parse(draftKey) as Lineup) });
    }, 350);
    return () => clearTimeout(timer);
  }, [pending, busy, connected, error, draftKey, ids.length, send]);
  const sectors = [
    { name: 'Ataque', positions: ['LW', 'RW', 'SS', 'ST'] },
    { name: 'Meio-campo', positions: ['DM', 'CM', 'AM', 'LM', 'RM'] },
    { name: 'Defesa', positions: ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB'] },
  ].map((sector) => {
    const members = entries.filter((entry) => sector.positions.includes(entry.position));
    return {
      name: sector.name,
      percent: members.length
        ? Math.round(members.reduce((sum, entry) => sum + entry.chemistry, 0) / members.length)
        : 0,
    };
  });
  const chemistry = Math.round(entries.reduce((sum, entry) => sum + entry.chemistry, 0) / 11);

  const target = entries[selected];
  const players = club.playerIds
    .map((id) => state.players.byId[id])
    .filter((player) => player !== undefined)
    .sort(
      (a, b) =>
        effectiveOverall(state, b) *
          learnedPositionFactor(state, b, target?.position ?? b.position) -
        effectiveOverall(state, a) *
          learnedPositionFactor(state, a, target?.position ?? a.position),
    );
  const selectedPlayer = target?.player;
  const effects = selectedPlayer ? temporaryModifiers(state, selectedPlayer) : [];
  const adjustedOverall = selectedPlayer ? effectiveOverall(state, selectedPlayer) : 0;
  const positionOverall = Math.floor(adjustedOverall * (target?.factor ?? 1));
  const positionPenalty = positionOverall - adjustedOverall;
  const chemistryPenalty = (target?.effectiveOverall ?? 0) - positionOverall;
  const fatiguePenalty = selectedPlayer
    ? fitnessOverall(target?.effectiveOverall ?? 0, selectedPlayer.fitness) -
      (target?.effectiveOverall ?? 0)
    : 0;
  function changeFormation(value: Formation) {
    const pool = Object.fromEntries(
      ids
        .map((id) => [id, state.players.byId[id]])
        .filter(
          (entry): entry is [string, NonNullable<(typeof state.players.byId)[string]>] =>
            entry[1] !== undefined,
        ),
    );
    setFormation(value);
    setStarters(
      resolveLineup(
        state,
        club,
        availabilityAt,
        ids.length === 11 ? pool : state.players.byId,
        value,
        [],
      ).flatMap((entry) => (entry.player ? [entry.player.id] : [])),
    );
    setDirty(true);
  }
  function assign(id: string, slot = selected) {
    if (!club.playerIds.includes(id) || !medicallyAvailable(state, id)) return;
    const next = [...ids];
    const old = next[slot];
    const existing = next.indexOf(id);
    if (existing >= 0 && old) next[existing] = old;
    if (existing < 0 && bench.includes(id))
      setBench(bench.map((reserve) => (reserve === id && old ? old : reserve)));
    next[slot] = id;
    setStarters(next);
    setDirty(true);
    setSelectionOpen(false);
  }
  const formationControl = (
    <Select
      aria-label="Formação"
      className="formation-select"
      menuMinWidth={240}
      value={formation}
      onValueChange={(value) => changeFormation(formationSchema.parse(value))}
    >
      {formationSchema.options.map((name) => (
        <Option key={name} value={name}>
          <span className="match-option-content">
            <FormationIcon formation={name} />
            <span>{FORMATION_LABELS[name]}</span>
          </span>
        </Option>
      ))}
    </Select>
  );
  const tacticalControls = (
    <>
      {' '}
      <PlayStylePicker
        value={style}
        onChange={(value) => {
          setStyle(value);
          setDirty(true);
        }}
      />
      <button className="tactical-analysis-button" onClick={() => setAnalysisOpen(true)}>
        Análise tática
      </button>
      {analysisOpen && (
        <TacticalAnalysis
          state={state}
          clubId={club.id}
          formation={formation}
          style={style}
          players={entries.flatMap((entry) => (entry.player ? [entry.player] : []))}
          onClose={() => setAnalysisOpen(false)}
        />
      )}
    </>
  );
  return (
    <div className="lineup-editor">
      {error && pending && (
        <div className="lineup-save-error" role="alert">
          <span>Não foi possível salvar as alterações.</span>
          <button
            className="secondary"
            onClick={() => {
              lastAttempt.current = '';
              useGameStore.getState().clearError();
            }}
          >
            Tentar salvar novamente
          </button>
        </div>
      )}
      <LineupPresets
        presets={state.lineupPresets?.[club.id] ?? []}
        current={{
          formation,
          starters: ids,
          style,
          bench: reserves,
          instructions: activeInstructions,
        }}
        onLoad={(plan) => {
          setInstructions(plan.instructions ?? emptyInstructions);
          setFormation(plan.formation);
          setStyle(plan.style ?? 'balanced');
          setStarters([...plan.starters]);
          const loadedIds = resolveLineup(
            state,
            club,
            availabilityAt,
            state.players.byId,
            plan.formation,
            plan.starters,
          ).flatMap((entry) => (entry.player ? [entry.player.id] : []));
          setBench(resolveBench(state, club, availabilityAt, loadedIds, plan.bench));
          setDirty(true);
          lastAttempt.current = '';
          useGameStore.getState().clearError();
        }}
      />
      <div className="lineup-layout">
        <div className="lineup-main-column">
          <section className="tactics-panel">
            <div className="tactics-header lineup-club-summary">
              <div className="lineup-summary-metrics">
                <SquadAverages state={snapshot.state} club={club} lineup={entries} />
                <div className="lineup-summary-stat">
                  <span>Entrosamento</span>
                  <strong>{chemistry}%</strong>
                </div>
              </div>
            </div>
            {mobile && <div className="lineup-mobile-formation">{formationControl}</div>}
            <div className="tactics-scroll">
              <div ref={pitchRef} className="tactics-field" style={{ height: fieldHeight }}>
                <svg
                  className="tactics-lines"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d={`M3 ${pitchTop}H97V${pitchBottom}H3ZM3 ${pitchMiddle}H97M30 ${pitchTop}V${pitchTop + penaltyDepth}H70V${pitchTop}M30 ${pitchBottom}V${pitchBottom - penaltyDepth}H70V${pitchBottom}`}
                    fill="none"
                    stroke="#e6f0ce55"
                    strokeWidth=".4"
                  />
                  <ellipse
                    cx="50"
                    cy={pitchMiddle}
                    rx="13"
                    ry={(pitchBottom - pitchTop) * 0.1}
                    fill="none"
                    stroke="#e6f0ce55"
                    strokeWidth=".4"
                  />
                  {FORMATION_LINKS[formation].map(([from, to]) => {
                    const entry = entries[from]!;
                    const other = entries[to]!;
                    return (
                      <line
                        key={from + '-' + to}
                        x1={entry.x}
                        y1={entry.y}
                        x2={other.x}
                        y2={other.y}
                        stroke={
                          Math.min(entry.chemistry, other.chemistry) >= 80
                            ? '#a5d96c'
                            : Math.min(entry.chemistry, other.chemistry) >= 40
                              ? '#dbc45b'
                              : '#bc7961'
                        }
                        strokeDasharray={
                          entry.factor < 1 || other.factor < 1 ? '1.2 .8' : undefined
                        }
                        strokeWidth=".5"
                        opacity=".8"
                      />
                    );
                  })}
                </svg>
                {entries.map((entry, index) => (
                  <button
                    key={index}
                    data-lineup-slot={index}
                    data-dragging={dragging === entry.player?.id}
                    draggable={!!entry.player}
                    onPointerDown={(event) => {
                      if (entry.player) startCardPointerDrag(event, entry.player.id);
                    }}
                    onDragStart={(event) => {
                      if (!entry.player) return;
                      event.dataTransfer.setData('text/plain', entry.player.id);
                      event.dataTransfer.effectAllowed = 'move';
                      showDraggedCard(event);
                      setDragging(entry.player.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      assign(event.dataTransfer.getData('text/plain'), index);
                      setDragging(null);
                    }}
                    data-tier={
                      (entry.player?.overall ?? 0) <= 69
                        ? 'bronze'
                        : (entry.player?.overall ?? 0) <= 77
                          ? 'silver'
                          : (entry.player?.overall ?? 0) <= 85
                            ? 'gold'
                            : 'diamond'
                    }
                    className={`tactics-player ${selected === index ? 'selected' : ''} ${entry.factor < 1 ? 'out-of-position' : ''}`}
                    style={{
                      left: `${entry.x}%`,
                      top: `${entry.y}%`,
                      zIndex: Math.round(entry.y * 10),
                    }}
                    aria-label={`Posição ${index + 1} ${positionLabel(entry.position)}: ${entry.player?.name ?? 'Vazia'}`}
                    aria-pressed={selected === index}
                    onClick={() => {
                      if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                      }
                      setSelected(index);
                      setSelectionOpen(true);
                    }}
                  >
                    <span className="tactics-rating">
                      <Overall
                        base={entry.player?.overall ?? 0}
                        modifier={
                          fitnessOverall(entry.effectiveOverall, entry.player?.fitness ?? 100) -
                          (entry.player?.overall ?? 0)
                        }
                      />
                      <small>{positionLabel(entry.position)}</small>
                    </span>
                    {entry.player && <Portrait player={entry.player} />}
                    <strong title={entry.player?.name}>
                      {entry.player ? cardPlayerName(entry.player.name) : 'Sem atleta'}
                    </strong>
                    <span
                      className="chemistry-meter"
                      aria-label={`Condicionamento físico ${Math.round(entry.player?.fitness ?? 0)}%`}
                    >
                      <i style={{ width: `${entry.player?.fitness ?? 0}%` }} />
                      <span>{Math.round(entry.player?.fitness ?? 0)}% COND</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {mobile && (
              <div className="tactics-clipboard lineup-integrated-tactics">{tacticalControls}</div>
            )}
            <MatchBench
              state={state}
              club={club}
              starters={ids}
              reserves={reserves}
              onMove={(id, targetId, related) => {
                if (
                  !club.playerIds.includes(id) ||
                  !medicallyAvailable(state, id) ||
                  id === targetId
                )
                  return;
                const slot = ids.indexOf(id);
                if (slot >= 0) {
                  if (targetId) assign(targetId, slot);
                  return;
                }
                const next = [...reserves];
                const source = next.indexOf(id);
                const target = targetId ? next.indexOf(targetId) : -1;
                if (related) {
                  if (source >= 0) return;
                  if (target >= 0) next[target] = id;
                  else if (source < 0 && next.length < 12) next.push(id);
                } else if (source >= 0) {
                  if (targetId && medicallyAvailable(state, targetId)) next[source] = targetId;
                  else next.splice(source, 1);
                }
                if (
                  next.length === reserves.length &&
                  next.every((id, index) => id === reserves[index])
                )
                  return;
                setBench(next);
                setDirty(true);
              }}
              onChange={(next) => {
                setBench(next);
                setDirty(true);
              }}
            />
          </section>
          <div className="lineup-support">
            <UnavailablePlayers state={state} club={club} />
            <section className="sector-chemistry" aria-label="Entrosamento por setor">
              <span className="eyebrow">CONEXÃO EM CAMPO</span>
              {sectors.map((sector) => (
                <div className="sector-chemistry-row" key={sector.name}>
                  <div>
                    <span>{sector.name}</span>
                    <strong>{sector.percent}%</strong>
                  </div>
                  <meter
                    min={0}
                    max={100}
                    value={sector.percent}
                    aria-label={`Entrosamento do ${sector.name.toLowerCase()}`}
                  />
                </div>
              ))}
            </section>
          </div>
        </div>
        <div className="tactics-sidebar">
          {!mobile && (
            <aside className="tactics-clipboard" aria-label="Prancheta tática">
              <span className="clipboard-pencil" aria-hidden="true" />
              <span className="eyebrow">PLANO DE JOGO</span>

              <label>Formação{formationControl}</label>
              {tacticalControls}
            </aside>
          )}
          <MatchInstructionsEditor
            state={state}
            club={club}
            starters={ids}
            reserves={reserves}
            value={activeInstructions}
            onChange={(value) => {
              setInstructions(value);
              setDirty(true);
            }}
          />
        </div>
        {selectionOpen && (
          <PlayerModal
            className="lineup-selection-modal"
            title={`${selectedPlayer?.name ?? 'Selecionar jogador'} · ${positionLabel(target?.position)}`}
            onClose={() => setSelectionOpen(false)}
          >
            <div className="lineup-selection-grid">
              <section className="lineup-player-detail">
                {selectedPlayer && (
                  <>
                    <PlayerCard
                      key={selectedPlayer.id}
                      player={selectedPlayer}
                      clubName={club.name}
                      kit={clubKit(club)}
                      modifier={
                        fitnessOverall(target?.effectiveOverall ?? 0, selectedPlayer.fitness) -
                        selectedPlayer.overall
                      }
                    />
                    <div className="lineup-effects">
                      <h3>O que afeta este jogador</h3>
                      {effects.map((effect) => (
                        <p
                          key={effect.label}
                          className={effect.value > 0 ? 'positive' : 'negative'}
                        >
                          <b>
                            {effect.value > 0 ? '+' : ''}
                            {effect.value} · {effect.label}
                          </b>
                          <small>{effect.until}</small>
                        </p>
                      ))}
                      {positionPenalty !== 0 && (
                        <p className="negative">
                          <b>{positionPenalty} · Fora da posição</b>
                          <small>
                            {positionLabel(selectedPlayer.position)} atuando como{' '}
                            {positionLabel(target?.position)} · Redução de{' '}
                            {Math.round((1 - (target?.factor ?? 1)) * 100)}%
                          </small>
                        </p>
                      )}
                      {chemistryPenalty !== 0 && (
                        <p className="negative">
                          <b>{chemistryPenalty} · Entrosamento</b>
                          <small>
                            {Math.round(target?.chemistry ?? 0)}% de adaptação · Melhora ao jogar
                            pelo clube.
                          </small>
                        </p>
                      )}
                      {fatiguePenalty !== 0 && (
                        <p className="negative">
                          <b>{fatiguePenalty} · Cansaço</b>
                          <small>
                            Condição física {selectedPlayer.fitness}% · Recupera com descanso.
                          </small>
                        </p>
                      )}
                      {!effects.length &&
                        !positionPenalty &&
                        !chemistryPenalty &&
                        !fatiguePenalty && <p>Sem bônus ou penalidades nesta posição.</p>}
                    </div>
                  </>
                )}
              </section>
              <section className="lineup-bench">
                <span className="eyebrow">OPÇÕES PARA A POSIÇÃO</span>
                <h2>Substituir por quem?</h2>
                <p>
                  Função diferente reduz o overall efetivo. Jogadores lesionados ficam
                  indisponíveis.
                </p>
                <div className="bench-list">
                  {players
                    .filter((player) => player.id !== selectedPlayer?.id)
                    .map((player) => {
                      const load = state.workload[player.id];
                      const risk = injuryProbability(
                        player.fitness,
                        (load?.consecutiveMatches ?? 0) + 1,
                        load ? Math.max(0, (availabilityAt - load.lastPlayedAt) / 3600000) : 168,
                        center.levels.medical,
                      );
                      return (
                        <button
                          key={player.id}
                          className={`bench-player ${ids.includes(player.id) ? 'starter' : ''}`}
                          disabled={!medicallyAvailable(state, player.id)}
                          onClick={() => assign(player.id)}
                        >
                          <Portrait player={player} />
                          <span>
                            <strong>{player.name}</strong>
                            <small>
                              {positionLabel(player.position)} · OVR {player.overall} · Na posição{' '}
                              {Math.floor(
                                effectiveOverall(state, player) *
                                  learnedPositionFactor(
                                    state,
                                    player,
                                    target?.position ?? player.position,
                                  ),
                              )}{' '}
                              · Condição {player.fitness}%
                            </small>
                            <small>
                              {state.injuries[player.id] && medicallyAvailable(state, player.id)
                                ? 'Liberado para a próxima partida'
                                : state.injuries[player.id]
                                  ? `Lesionado · ${state.injuries[player.id]} dias`
                                  : `Risco ${Math.round(risk * 100)}% · ${load?.consecutiveMatches ?? 0} jogos seguidos`}
                            </small>
                          </span>
                          <b>{ids.includes(player.id) ? 'Trocar' : 'Escalar'}</b>
                        </button>
                      );
                    })}
                </div>
              </section>
            </div>
          </PlayerModal>
        )}
      </div>
    </div>
  );
}
