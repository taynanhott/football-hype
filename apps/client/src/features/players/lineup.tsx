import { PixelBadge } from '../../ui/pixel-badge';
import { PlayStylePicker } from './play-style-picker';
import { TacticalAnalysis } from './tactical-analysis';
import { positionLabel } from '../../ui/position-label';
import { Select, Option } from '../../ui/select';
import { PlayerCard } from './player-card';
import { Overall } from './overall';
import { useEffect, useRef, useState } from 'react';
import {
  GAMEPLAY,
  clubKit,
  formationSchema,
  type PlayStyle,
  type Formation,
  type Lineup,
} from '@football/shared';
import {
  medicallyAvailable,
  resolveLineup,
  resolveBench,
  injuryProbability,
  positionFactor,
  effectiveOverall,
  temporaryModifiers,
} from '@football/domain';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { Portrait } from './pixel-portrait';
import { PlayerModal } from './player-modal';
import { LineupPresets } from './lineup-presets';
import { MatchBench } from './match-bench';

export function LineupEditor({ snapshot, club, center }: ViewProps) {
  const state = snapshot.state;
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
      state.nextScheduledAt,
      resolveLineup(state, club, state.nextScheduledAt).flatMap((entry) =>
        entry.player ? [entry.player.id] : [],
      ),
    ),
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
    state.nextScheduledAt,
    state.players.byId,
    formation,
    starters,
    style,
  );
  const formationRows = [...new Set(resolvedEntries.map((entry) => entry.y))].sort((a, b) => b - a);
  const fieldHeight = 620;
  const rowY = (index: number) => 88 - (index / Math.max(1, formationRows.length - 1)) * 74;
  const entries = resolvedEntries.map((entry) => ({
    ...entry,
    y: rowY(formationRows.indexOf(entry.y)),
  }));
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
  const reserves = bench.filter(
    (id) => !ids.includes(id) && club.playerIds.includes(id) && medicallyAvailable(state, id),
  );
  const draftKey = JSON.stringify({ formation, starters: ids, style, bench: reserves });
  const saved = state.tactics[club.id];
  const savedKey = saved
    ? JSON.stringify({
        formation: saved.formation,
        starters: saved.starters,
        style: saved.style ?? 'balanced',
        bench: saved.bench ?? [],
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
    { name: 'Ataque', positions: ['LW', 'RW', 'ST'] },
    { name: 'Meio-campo', positions: ['DM', 'CM', 'AM', 'LM', 'RM'] },
    { name: 'Defesa', positions: ['GK', 'CB', 'LB', 'RB'] },
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
  const overall = Math.round(
    entries.reduce(
      (sum, entry) => sum + fitnessOverall(entry.effectiveOverall, entry.player?.fitness ?? 100),
      0,
    ) / 11,
  );
  const target = entries[selected];
  const players = club.playerIds
    .map((id) => state.players.byId[id])
    .filter((player) => player !== undefined)
    .sort(
      (a, b) =>
        effectiveOverall(state, b) * positionFactor(b.position, target?.position ?? b.position) -
        effectiveOverall(state, a) * positionFactor(a.position, target?.position ?? a.position),
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
        state.nextScheduledAt,
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
      <div className="lineup-layout">
        <section className="tactics-panel">
          <div className="tactics-header lineup-club-summary">
            <a className="lineup-club-identity" href={'#/trophies?club=' + club.id}>
              <PixelBadge
                name={club.name}
                {...(club.crestUrl ? { url: club.crestUrl } : {})}
                size={30}
              />
              <strong>{club.name}</strong>
            </a>
            <div className="lineup-summary-metrics">
              <div className="lineup-summary-stat">
                <span>Força efetiva</span>
                <strong>{overall}</strong>
              </div>
              <div className="lineup-summary-stat">
                <span>Entrosamento</span>
                <strong>{chemistry}%</strong>
              </div>
            </div>
          </div>
          <div className="tactics-scroll">
            <div className="tactics-field" style={{ height: fieldHeight }}>
              <svg
                className="tactics-lines"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={`M8 ${pitchTop}H92V${pitchBottom}H8ZM8 ${pitchMiddle}H92M30 ${pitchTop}V${pitchTop + penaltyDepth}H70V${pitchTop}M30 ${pitchBottom}V${pitchBottom - penaltyDepth}H70V${pitchBottom}`}
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
                {entries.flatMap((entry, index) =>
                  entries
                    .slice(index + 1)
                    .filter((other) => Math.hypot(other.x - entry.x, other.y - entry.y) < 37)
                    .map((other) => (
                      <line
                        key={`${entry.x}-${entry.y}-${other.x}-${other.y}`}
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
                        strokeWidth=".5"
                        opacity=".7"
                      />
                    )),
                )}
              </svg>
              {entries.map((entry, index) => (
                <button
                  key={index}
                  data-lineup-slot={index}
                  data-dragging={dragging === entry.player?.id}
                  draggable={!!entry.player}
                  onDragStart={(event) => {
                    if (!entry.player) return;
                    event.dataTransfer.setData('text/plain', entry.player.id);
                    event.dataTransfer.effectAllowed = 'move';
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
                  style={{ left: `${entry.x}%`, top: `${entry.y}%` }}
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
                  <strong>{entry.player?.name ?? 'Sem atleta'}</strong>
                  <span className="chemistry-meter">
                    <i style={{ width: `${entry.chemistry}%` }} />
                  </span>
                  <small className="tactics-chemistry">{entry.chemistry}% ENT.</small>
                </button>
              ))}
            </div>
          </div>
          <MatchBench
            state={state}
            club={club}
            starters={ids}
            reserves={reserves}
            onMove={(id, targetId, related) => {
              if (!club.playerIds.includes(id) || !medicallyAvailable(state, id) || id === targetId)
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
                if (source >= 0 && target >= 0)
                  [next[source], next[target]] = [next[target]!, next[source]!];
                else if (source < 0 && target >= 0) next[target] = id;
                else if (source < 0 && next.length < 12) next.push(id);
              } else if (source >= 0) {
                if (targetId && medicallyAvailable(state, targetId)) next[source] = targetId;
                else next.splice(source, 1);
              }
              setBench(next);
              setDirty(true);
            }}
            onChange={(next) => {
              setBench(next);
              setDirty(true);
            }}
          />
        </section>
        <div className="tactics-sidebar">
          <aside className="tactics-clipboard" aria-label="Prancheta tática">
            <span className="clipboard-pencil" aria-hidden="true" />
            <span className="eyebrow">PLANO DE JOGO</span>

            <label>
              Formação
              <Select
                aria-label="Formação"
                value={formation}
                onValueChange={(value) => changeFormation(formationSchema.parse(value))}
              >
                {formationSchema.options.map((name) => (
                  <Option key={name}>{name}</Option>
                ))}
              </Select>
            </label>
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
          </aside>
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
          <LineupPresets
            presets={state.lineupPresets?.[club.id] ?? []}
            current={{ formation, starters: ids, style, bench: reserves }}
            onLoad={(plan) => {
              setFormation(plan.formation);
              setStyle(plan.style ?? 'balanced');
              setStarters([...plan.starters]);
              const loadedIds = resolveLineup(
                state,
                club,
                state.nextScheduledAt,
                state.players.byId,
                plan.formation,
                plan.starters,
              ).flatMap((entry) => (entry.player ? [entry.player.id] : []));
              setBench(resolveBench(state, club, state.nextScheduledAt, loadedIds, plan.bench));
              setDirty(true);
              lastAttempt.current = '';
              useGameStore.getState().clearError();
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
                            {target?.chemistry}% de adaptação · Melhora ao jogar pelo clube.
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
                        load
                          ? Math.max(0, (state.nextScheduledAt - load.lastPlayedAt) / 3600000)
                          : 168,
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
                                  positionFactor(
                                    player.position,
                                    target?.position ?? player.position,
                                  ),
                              )}{' '}
                              · Condição {player.fitness}%
                            </small>
                            <small>
                              {state.injuries[player.id] && medicallyAvailable(state, player.id)
                                ? 'Liberado para a próxima partida'
                                : state.injuries[player.id]
                                  ? `Lesionado · ${state.injuries[player.id]} jogos`
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
