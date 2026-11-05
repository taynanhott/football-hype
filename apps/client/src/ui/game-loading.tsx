import { Icon } from './icons';
import { pendingFixtures, scheduledBatches } from '@football/domain';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../store/game-store';
import { useSimulationNavigationLock } from './use-simulation-navigation-lock';

export function GameLoading() {
  const pending = useGameStore((state) => state.busy && !state.error);
  const startedAt = useGameStore((store) => {
    const state = store.snapshot?.state;
    const clubId = state?.participants.find((p) => p.userId === store.userId)?.clubId;
    return state?.results.filter((r) => r.homeId === clubId || r.awayId === clubId).at(-1)
      ?.startedAt;
  });
  const clockOffset = useGameStore((store) => store.clockOffset);
  const playing = useSimulationNavigationLock(startedAt, clockOffset);
  const busy = pending && !playing;
  const moving = useGameStore((state) => Boolean(state.snapshot));
  const activity = useGameStore((store) => {
    if (store.loadingActivity) return store.loadingActivity;
    const state = store.snapshot?.state;
    if (!state) return null;
    const clubId = state.participants.find((member) => member.userId === store.userId)?.clubId;
    const fixtures = pendingFixtures(state);
    const batch = state.seasonClock
      ? (scheduledBatches(fixtures)[0] ?? [])
      : fixtures.filter((fixture) => fixture.scheduledAt === fixtures[0]?.scheduledAt);
    return batch.some((fixture) => fixture.homeId === clubId || fixture.awayId === clubId)
      ? 'travel'
      : 'training';
  });
  const training = moving && activity === 'training';
  const message = useGameStore((state) => state.loadingMessage);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!busy || !dialog) return;
    dialog.showModal();
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.documentElement.style.overflow = previous;
    };
  }, [busy]);
  if (!busy) return null;
  return createPortal(
    <dialog
      ref={ref}
      className="game-loading-screen"
      aria-label="Aguarde"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="game-loading-content" role="status" aria-live="polite">
        {training ? (
          <div className="training-loading-scene" aria-hidden="true">
            <svg viewBox="0 0 130 70" width="130" height="70" fill="none">
              <rect
                x="2"
                y="3"
                width="126"
                height="64"
                rx="4"
                fill="#211b0a"
                fillOpacity=".96"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M65 3v64M2 22h16v26H2M128 22h-16v26h16"
                stroke="currentColor"
                opacity=".85"
              />
              <circle cx="65" cy="35" r="12" stroke="currentColor" opacity=".85" />
              <circle
                className="training-loading-player"
                cx="34"
                cy="43"
                r="6"
                fill="#dcca83"
                stroke="#fff0bd"
              />
              <circle
                className="training-loading-receiver"
                cx="82"
                cy="24"
                r="6"
                fill="#dcca83"
                stroke="#fff0bd"
              />
              <circle
                className="training-loading-defender"
                cx="101"
                cy="48"
                r="6"
                fill="#6b571d"
                stroke="#f5d76e"
              />
              <circle cx="53" cy="18" r="6" fill="#6b571d" stroke="#f5d76e" />
              <path
                className="training-loading-route"
                d="M43 40L82 24L94 36L121 35"
                stroke="currentColor"
                strokeDasharray="3 4"
                opacity=".3"
              />
              <circle className="training-loading-pass" cx="43" cy="40" r="2.5" fill="#fff7dd" />
            </svg>
          </div>
        ) : moving ? (
          <div className="team-bus-scene" aria-hidden="true">
            <svg className="team-bus" viewBox="0 0 260 130" width="260" height="130">
              <path
                d="M16 96H245V38Q245 20 226 20H39Q16 20 16 42Z"
                fill="#e4cb79"
                stroke="#362b0c"
                strokeWidth="4"
              />
              <path d="M25 68H239V94H25Z" fill="#8b7023" />
              <path d="M31 29H211V62H31ZM219 29H229Q238 29 238 40V62H219Z" fill="#493b13" />
              <path d="M74 29V62M119 29V62M164 29V62" stroke="#e4cb79" strokeWidth="5" />
              <path
                d="M28 47L53 30M85 48L110 30M131 48L155 30M177 48L201 30"
                stroke="#fff0b5"
                opacity=".3"
                strokeWidth="5"
              />
              <path d="M29 78H39M224 78H239" stroke="#fff5b4" strokeWidth="5" />
              {[61, 202].map((x) => (
                <g className="team-bus-wheel" key={x} style={{ transformOrigin: x + 'px 98px' }}>
                  <circle cx={x} cy="98" r="17" fill="#362b0c" />
                  <circle cx={x} cy="98" r="9" fill="#dcca83" />
                  <path
                    d={'M' + (x - 7) + ' 98h14M' + x + ' 91v14'}
                    stroke="#6b571d"
                    strokeWidth="3"
                  />
                </g>
              ))}
            </svg>
            <div className="team-bus-road" />
          </div>
        ) : (
          <div className="career-loading-ball" aria-hidden="true">
            <Icon name="ball" size={32} />
          </div>
        )}
        <strong>
          {moving
            ? training
              ? 'Time em treinamento…'
              : 'Time em movimento…'
            : (message ?? 'Carregando carreira…')}
        </strong>
      </div>
    </dialog>,
    document.body,
  );
}
