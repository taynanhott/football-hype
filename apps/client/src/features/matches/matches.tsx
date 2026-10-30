import { clubKit, MATCH_DURATION_MS, type MatchResult } from '@football/shared';
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PixelBadge } from '../../ui/pixel-badge';
import type { ViewProps } from '../../ui/view-props';
import { useGameStore } from '../../store/game-store';
import { visibleActionMinute } from '../../three/match-playback';
import { MatchActors } from '../../three/match-actors';
import { GoalsAndCards, MatchStatistics, PlayerRatings, RoundResults } from './match-summary';
const StadiumScene = lazy(() => import('../../three/stadium-scene'));
const labels: Record<string, string> = {
  interception: 'Interceptação',
  'free-kick': 'Falta com barreira',
  penalty: 'Pênalti',
  cross: 'Cruzamento',
  dribble: 'Condução de bola',
  save: 'Defesa do goleiro',
  'goal-kick': 'Tiro de meta',
  goal: 'Gol',
  yellow: 'Cartão amarelo',
  red: 'Expulsão',
  kickoff: 'Saída no meio-campo',
  pass: 'Passe',
  shot: 'Chute',
  tackle: 'Roubo de bola',
  foul: 'Falta',
  corner: 'Escanteio',
};
function actionLabel(action: NonNullable<MatchResult['actions']>[number]) {
  if (action.type === 'free-kick')
    return action.wallIds?.length ? 'Falta com barreira' : 'Cobrança de falta';
  if (['pass', 'cross'].includes(action.type) && action.outcome === 'intercepted')
    return action.type === 'pass' ? 'Passe interceptado' : 'Cruzamento interceptado';
  if (action.type === 'shot' && action.outcome === 'saved') return 'Chute defendido';
  if (action.type === 'shot' && action.outcome === 'blocked') return 'Chute bloqueado';
  return labels[action.type];
}
function cheer(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 1.5, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++)
    samples[i] = (Math.random() * 2 - 1) * Math.sin((i / samples.length) * Math.PI);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1300;
  const gain = context.createGain();
  gain.gain.value = 0.3;
  source.connect(filter).connect(gain).connect(context.destination);
  source.start();
}
function subscribeReportLayout(listener: () => void) {
  const query = window.matchMedia('(min-width: 901px)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
function desktopReportLayout() {
  return window.matchMedia('(min-width: 901px)').matches;
}
export function Matches({ snapshot, club }: ViewProps) {
  const desktop = useSyncExternalStore(subscribeReportLayout, desktopReportLayout, () => false);
  const { state } = snapshot;
  const available = state.results.filter((r) => r.homeId === club.id || r.awayId === club.id);
  const [selected, setSelected] = useState('');
  const [replay, setReplay] = useState<{ id: string; start: number } | null>(null);
  const scene = useRef<HTMLDivElement>(null);
  const reports = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);
  const frameContent = (target: { current: HTMLDivElement | null }) => {
    cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() =>
      target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };
  const [reportTab, setReportTab] = useState('round');
  const activeReportTab = desktop && reportTab === 'ratings' ? 'stats' : reportTab;
  const result = state.results.find((r) => r.fixtureId === selected) ?? available.at(-1);
  const clockOffset = useGameStore((s) => s.clockOffset);
  const [now, setNow] = useState(() => Date.now());
  const sound = useRef<AudioContext | null>(null);
  const heard = useRef(new Set<string>());
  const [soundOn, setSoundOn] = useState(true);
  const isReplay = replay?.id === result?.fixtureId && replay !== null;
  const start = isReplay ? replay.start : (result?.startedAt ?? 0);
  const elapsed = Math.max(0, now + (isReplay ? 0 : clockOffset) - start);
  const roundMinute = Math.min(
    90,
    (Math.max(0, now + clockOffset - (result?.startedAt ?? 0)) / MATCH_DURATION_MS) * 90,
  );
  const selectMatch = (id: string, time: number) => {
    const match = state.results.find((item) => item.fixtureId === id);
    if (!match) return;
    setSelected(id);
    setReplay(null);
    setNow(time);
    frameContent(scene);
  };
  const minute = Math.min(90, (elapsed / MATCH_DURATION_MS) * 90);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(timer);
  }, []);
  const playing = Boolean(result) && elapsed < MATCH_DURATION_MS;
  useEffect(() => {
    if (!soundOn || !playing) return;
    const context = new AudioContext();
    sound.current = context;
    const buffer = context.createBuffer(2, context.sampleRate * 12, context.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      let murmur = 0;
      for (let i = 0; i < samples.length; i++) {
        murmur = murmur * 0.85 + (Math.random() * 2 - 1) * 0.15;
        samples[i] = murmur;
      }
      // Blend the loop seam without modulating the crowd's volume.
      const seam = Math.floor(context.sampleRate * 0.15);
      const end = samples[samples.length - 1]!;
      for (let i = 0; i < seam; i++) {
        const blend = (1 - Math.cos((i / seam) * Math.PI)) / 2;
        samples[i] = end * (1 - blend) + samples[i]! * blend;
      }
    }
    const crowd = context.createBufferSource();
    crowd.buffer = buffer;
    crowd.loop = true;
    const bassCut = context.createBiquadFilter();
    bassCut.type = 'highpass';
    bassCut.frequency.value = 250;
    bassCut.Q.value = 0.5;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.5;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.09, context.currentTime + 1.5);
    crowd.connect(bassCut).connect(filter).connect(gain).connect(context.destination);
    crowd.start();
    // Browsers may require the first user gesture before playing audio.
    const resume = () => {
      void context.resume().catch(() => {});
    };
    resume();
    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
      crowd.stop();
      if (sound.current === context) sound.current = null;
      void context.close();
    };
  }, [soundOn, playing]);
  useEffect(() => {
    if (!result || !soundOn || elapsed >= MATCH_DURATION_MS) return;
    for (const [index, event] of (result.actions ?? []).entries()) {
      const key = `${result.fixtureId}:${start}:${index}`;
      if (
        event.type === 'goal' &&
        visibleActionMinute(result.actions ?? [], index) <= minute &&
        minute - visibleActionMinute(result.actions ?? [], index) < 1 &&
        !heard.current.has(key)
      ) {
        heard.current.add(key);
        if (sound.current) cheer(sound.current);
      }
    }
  }, [result, minute, elapsed, start, soundOn]);
  if (!result)
    return (
      <section className="panel">
        <h1>Central de partidas</h1>
        <p>Avance uma rodada para acompanhar seu clube em campo.</p>
      </section>
    );
  const home = state.clubs.byId[result.homeId ?? ''];
  const away = state.clubs.byId[result.awayId ?? ''];
  const stadium = state.stadiums.byId[result.stadiumId ?? ''];
  const center = home ? state.centers.byId[home.trainingCenterId] : undefined;
  const shown = (result.actions ?? []).filter(
    (a, index) => a.minute <= minute && visibleActionMinute(result.actions ?? [], index) <= minute,
  );
  const scores = ['home', 'away'].map(
    (side) => shown.filter((a) => a.type === 'goal' && a.side === side).length,
  );
  const last = shown.at(-1);
  const clockSeconds = Math.floor(minute * 60);
  const matchClock = `${String(Math.floor(clockSeconds / 60)).padStart(2, '0')}:${String(clockSeconds % 60).padStart(2, '0')}`;
  const period = minute >= 90 ? 'FIM' : minute >= 45 ? '2T' : '1T';
  return (
    <div className="match-center">
      {!result.actions?.some((action) => action.outcome) && (
        <p role="status" className="panel">
          Esta partida foi salva antes da atualização. Avance uma rodada para acompanhar as novas
          jogadas.
        </p>
      )}
      <section className="match-broadcast match-score" aria-label="Transmissão da partida">
        <div className="match-scene" ref={scene}>
          {stadium && center ? (
            <Suspense fallback={<p>Carregando estádio…</p>}>
              <StadiumScene
                showNeighborhood
                matchView
                homeKit={clubKit(home ?? { name: '' })}
                awayKit={clubKit(away ?? { name: '' })}
                stadium={stadium}
                center={center}
                occupancy={
                  result.attendance /
                  Math.max(
                    1,
                    stadium.sectors.reduce((s, v) => s + v.capacity, 0),
                  )
                }
              >
                <MatchActors
                  key={`${result.fixtureId}:${start}`}
                  state={state}
                  result={result}
                  elapsed={elapsed}
                />
              </StadiumScene>
            </Suspense>
          ) : (
            <p>Estádio indisponível para esta partida.</p>
          )}
          <button
            className="match-sound-toggle"
            aria-label={soundOn ? 'Silenciar torcida' : 'Ativar som da torcida'}
            title={soundOn ? 'Silenciar torcida' : 'Ativar som da torcida'}
            aria-pressed={soundOn}
            onClick={() => setSoundOn((value) => !value)}
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M11 5 6 9H3v6h3l5 4Z" />
              {soundOn ? (
                <>
                  <path d="M15 8a6 6 0 0 1 0 8" />
                  <path d="M18 5a10 10 0 0 1 0 14" />
                </>
              ) : (
                <path d="m16 9 6 6m0-6-6 6" />
              )}
            </svg>
          </button>
          <div className="match-score-overlay">
            <div
              className="broadcast-scoreboard"
              role="group"
              aria-label={`Placar: ${home?.name} ${scores[0]} a ${scores[1]} ${away?.name}`}
            >
              <div className="broadcast-scoreline">
                <div
                  className="broadcast-team broadcast-team-home"
                  style={{ borderColor: clubKit(home ?? { name: '' }).primary }}
                  title={home?.name}
                >
                  <PixelBadge
                    name={home?.name ?? 'Mandante'}
                    {...(home?.crestUrl ? { url: home.crestUrl } : {})}
                    size={38}
                  />
                  <a href={'#/trophies?club=' + home?.id}>{home?.abbreviation ?? 'MAN'}</a>
                </div>
                <div className="broadcast-goals">
                  <span>{scores[0]}</span>
                  <span className="broadcast-divider" aria-hidden="true" />
                  <span>{scores[1]}</span>
                </div>
                <div
                  className="broadcast-team broadcast-team-away"
                  style={{ borderColor: clubKit(away ?? { name: '' }).primary }}
                  title={away?.name}
                >
                  <a href={'#/trophies?club=' + away?.id}>{away?.abbreviation ?? 'VIS'}</a>
                  <PixelBadge
                    name={away?.name ?? 'Visitante'}
                    {...(away?.crestUrl ? { url: away.crestUrl } : {})}
                    size={38}
                  />
                </div>
              </div>
              <div className="broadcast-clock">
                <span>{period}</span>
                <time>{matchClock}</time>
              </div>
            </div>
          </div>
          <p className="match-caption" role="status" aria-live="polite" aria-atomic="true">
            {last
              ? `${actionLabel(last)} · ${state.players.byId[last.playerId ?? '']?.name ?? ''}${last.interceptorId ? ` · Interceptado por ${state.players.byId[last.interceptorId]?.name ?? ''}` : ['pass', 'cross'].includes(last.type) && last.targetId ? ` → ${state.players.byId[last.targetId]?.name ?? ''}` : ''}`
              : 'A bola vai rolar'}
          </p>
          {!playing && (
            <div className="match-end-overlay" role="group" aria-label="Opções após a partida">
              <div className="match-end-actions">
                <button
                  className="match-end-home"
                  onClick={() => {
                    location.hash = '/dashboard';
                  }}
                >
                  Voltar à página inicial <span aria-hidden="true">→</span>
                </button>
                <button
                  className="match-end-replay"
                  onClick={() => {
                    const time = Date.now();
                    setReplay({ id: result.fixtureId, start: time });
                    setNow(time);
                  }}
                >
                  <span aria-hidden="true">↻</span> Rever partida
                </button>
              </div>
            </div>
          )}
        </div>{' '}
      </section>
      <div className="match-reports-layout" ref={reports}>
        <section className="match-report-tabs" aria-label="Informações da partida">
          <div className="match-tab-list" role="tablist" aria-label="Relatório da partida">
            {[
              ['stats', 'Estatísticas'],
              ['round', 'Partidas'],
              ['ratings', 'Notas dos jogadores'],
              ['events', 'Gols e cartões'],
            ]
              .filter(([id]) => !desktop || id !== 'ratings')
              .map(([id, label]) => (
                <button
                  key={id}
                  id={`match-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeReportTab === id}
                  aria-controls="match-report-panel"
                  tabIndex={activeReportTab === id ? 0 : -1}
                  onClick={() => {
                    setReportTab(id!);
                    frameContent(reports);
                  }}
                  onKeyDown={(event) => {
                    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
                    if (!keys.includes(event.key)) return;
                    event.preventDefault();
                    const tabs = Array.from(
                      event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                        '[role="tab"]',
                      ),
                    );
                    const index = tabs.indexOf(event.currentTarget);
                    const next =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
                            tabs.length;
                    tabs[next]?.focus();
                    tabs[next]?.click();
                  }}
                >
                  {label}
                </button>
              ))}
          </div>
          <div
            id="match-report-panel"
            className={
              'match-tab-panel ' + (activeReportTab === 'ratings' ? 'match-ratings-body' : '')
            }
            role="tabpanel"
            aria-labelledby={`match-tab-${activeReportTab}`}
            tabIndex={0}
          >
            {activeReportTab === 'round' && (
              <RoundResults
                state={state}
                result={result}
                minute={roundMinute}
                onSelect={selectMatch}
                viewerClubId={club.id}
              />
            )}
            {activeReportTab === 'stats' && (
              <MatchStatistics
                state={state}
                result={result}
                viewerClubId={club.id}
                minute={minute}
              />
            )}
            {activeReportTab === 'ratings' && (
              <PlayerRatings state={state} result={result} minute={minute} />
            )}
            {activeReportTab === 'events' && (
              <GoalsAndCards state={state} result={result} minute={minute} />
            )}
          </div>
        </section>
        {desktop && (
          <aside className="match-ratings-persistent" aria-label="Notas dos jogadores">
            <header className="persistent-ratings-heading">
              <h2>Notas dos jogadores</h2>
            </header>
            <div className="match-tab-panel match-ratings-body" tabIndex={0}>
              <PlayerRatings state={state} result={result} minute={minute} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
