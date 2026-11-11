import { seasonAwardsCalendarDate } from '../competitions/season-awards-date';
import type { WorldState } from '@football/shared';
import { useGameStore } from '../../store/game-store';
import { Portrait } from '../players/pixel-portrait';
import { useEffect, useRef, useState } from 'react';
import { openModalPreservingScroll } from '../../ui/modal-scroll';
import './season-awards.css';
import { GeneratedPerson } from '../../ui/person-avatar';
import { Icon } from '../../ui/icons';
import { PixelBadge } from '../../ui/pixel-badge';
const clubs = ['Palmeiras', 'Flamengo', 'Botafogo', 'São Paulo', 'Corinthians', 'Santos'];
function AwardPerson({
  name,
  index,
  coach = false,
  clubName,
}: {
  name: string;
  index: number;
  coach?: boolean;
  clubName?: string | undefined;
}) {
  const club = clubName ?? clubs[index % clubs.length]!;
  const player = useGameStore((s) =>
    Object.values(s.snapshot?.state.players.byId ?? {}).find((p) => p.name === name),
  );
  return (
    <>
      {player && clubName && !coach ? (
        <span className="award-real-portrait">
          <Portrait player={player} clubName={club} />
        </span>
      ) : (
        <GeneratedPerson
          name={name}
          className="award-portrait"
          framed
          outfit={['#176442', '#ab2434', '#202126'][index % 3]!}
          outfitStyle={coach ? 'terno' : 'camisa'}
        />
      )}
      <strong>{name}</strong>
      <span className="award-club">
        <PixelBadge name={club} size={18} />
        {club}
      </span>
    </>
  );
}

const names = [
  'Rafael Costa',
  'Gabriel Santos',
  'Lucas Ferreira',
  'Pedro Almeida',
  'Bruno Silva',
  'Matheus Lima',
  'André Rocha',
  'Felipe Martins',
  'João Ribeiro',
  'Diego Souza',
  'Victor Moreira',
  'Henrique Alves',
  'Miguel Torres',
];
const categories = [
  'Seleção do ano · Brasil',
  'Seleção do ano · Mundo',
  'Melhor técnico',
  'Melhor goleiro',
  'Melhor jogador do Brasil',
  'Melhor jogador do mundo',
];
const positions = [
  'Goleiro',
  'Lateral direito',
  'Zagueiro',
  'Zagueiro',
  'Lateral esquerdo',
  'Volante',
  'Meio-campista',
  'Meia ofensivo',
  'Ponta direita',
  'Atacante',
  'Ponta esquerda',
];

export function SeasonAwardsDemo() {
  const snapshot = useGameStore((s) => s.snapshot);
  const awards = snapshot?.state.seasonAwards?.filter((a) => a.season === snapshot.state.season);
  const [real, setReal] = useState(false);
  const world = snapshot?.state;
  useEffect(() => {
    if (
      !world ||
      (world.status !== 'finished' && world.seasonClosing?.stage !== 'end') ||
      !world.seasonAwards?.some((a) => a.season === world.season)
    )
      return;
    const key = 'football:awards-shown:' + world.id + ':' + world.season;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      /* Session presentation still works. */
    }
    const finale = world.results.find((r) => r.fixtureId === 'intercontinental:final');
    const delay = Math.max(
      0,
      (finale?.startedAt ?? 0) + (finale?.durationMs ?? 90000) - Date.now(),
    );
    const timer = window.setTimeout(() => {
      setReal(true);
      try {
        localStorage.setItem(key, '1');
      } catch {
        /* No career state is stored here. */
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [world]);
  useEffect(() => {
    const open = () => {
      if (
        awards?.length &&
        world &&
        new Date(world.lastProcessedAt - 10800000).toISOString().slice(0, 10) >=
          new Date(seasonAwardsCalendarDate(world).at - 10800000).toISOString().slice(0, 10)
      )
        setReal(true);
    };
    window.addEventListener('football:open-season-awards', open);
    return () => window.removeEventListener('football:open-season-awards', open);
  }, [awards, world]);
  return real && awards ? (
    <Ceremony cast={names} awards={awards} onClose={() => setReal(false)} />
  ) : null;
}

function Ceremony({
  cast: demoCast,
  onClose,
  awards,
}: {
  cast: string[];
  onClose: () => void;
  awards?: WorldState['seasonAwards'];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const categoryIds = ['team-br', 'team-world', 'coach', 'keeper', 'player-br', 'player-world'];
  const current = awards?.find((a) => a.category === categoryIds[step]);
  const cast = current ? current.winners.map((w) => w.name) : demoCast;
  const isTeam = step < 2;
  const isCoach = step === 2;
  const isKeeper = step === 3;
  const usedTeamIds = new Set<string>();
  const teamSlots = ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'ST', 'LW'].map(
    (position) => {
      const winner = current?.winners.find(
        (w) => w.position === position && !usedTeamIds.has(w.id),
      );
      if (winner) usedTeamIds.add(winner.id);
      return winner;
    },
  );
  const teamCast = current
    ? teamSlots.map((w) => w?.name ?? 'Sem atleta elegível')
    : step === 1
      ? [...cast.slice(4), ...cast.slice(0, 4)]
      : cast;
  const [candidateOrders] = useState(() =>
    Array.from({ length: categories.length }, () => {
      const order = [0, 1, 2];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      return order;
    }),
  );
  const [revealed, setRevealed] = useState(false);
  const finalists = useRef<HTMLDivElement>(null);
  const [shownPlayers, setShownPlayers] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => openModalPreservingScroll(dialog.current), []);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(
      () => {
        if (isTeam && shownPlayers < 11) {
          const count = shownPlayers + 1;
          setShownPlayers(count);
          if (count === 11) setRevealed(true);
        } else if (!revealed) setRevealed(true);
        else if (step < categories.length - 1) {
          setShownPlayers(0);
          setStep(step + 1);
          setRevealed(false);
        }
      },
      isTeam && shownPlayers < 11 ? 1300 : revealed ? 9000 : 3500,
    );
    return () => window.clearTimeout(timer);
  }, [step, revealed, paused, shownPlayers, isTeam]);
  const next = () => {
    if (isTeam && shownPlayers < 11) {
      const count = shownPlayers + 1;
      setShownPlayers(count);
      if (count === 11) setRevealed(true);
    } else if (!revealed) setRevealed(true);
    else if (step < categories.length - 1) {
      setShownPlayers(0);
      setStep(step + 1);
      setRevealed(false);
    } else onClose();
  };
  return (
    <dialog
      ref={dialog}
      className="awards-theatre"
      onCancel={onClose}
      aria-labelledby="awards-title"
    >
      <div className="awards-top">
        <span>FOOTBALL HYPE · GALA DA TEMPORADA</span>
      </div>
      <div className="awards-stage">
        <div className="award-particles" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 43) % 100}%`,
                animationDelay: `${-i * 0.7}s`,
                animationDuration: `${5 + (i % 5)}s`,
              }}
            />
          ))}
        </div>
        <div className="awards-beam left" />
        <div className="awards-beam right" />
        <div className="awards-host awards-pixel-host" aria-label="Avatar apresentador de terno">
          <GeneratedPerson name="Apresentador do sorteio" outfit="#20212d" outfitStyle="terno" />
          <div className="award-speech-bubble" role="status" aria-live="polite">
            {isTeam
              ? shownPlayers === 0
                ? 'Vamos conhecer a seleção do ano!'
                : positions[shownPlayers - 1] +
                  ': ' +
                  teamCast[shownPlayers - 1] +
                  ', do ' +
                  (teamSlots[shownPlayers - 1]?.clubName ??
                    clubs[(shownPlayers - 1) % clubs.length]) +
                  '!'
              : revealed
                ? 'O prêmio de ' +
                  categories[step]?.toLowerCase() +
                  ' vai para ' +
                  (current
                    ? current.winners[0]?.name
                    : isCoach
                      ? 'Eduardo Monteiro'
                      : cast[isKeeper ? 0 : step === 4 ? 9 : 12]) +
                  '!'
                : 'Estes são os três finalistas. O prêmio vai para…'}
          </div>
        </div>
        <div className="awards-screen" key={step}>
          <div className="gala-light-canopy" aria-hidden="true" />
          <div className="gala-screen-sparks" aria-hidden="true">
            {Array.from({ length: 36 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: ((i * 37) % 100) + '%',
                  top: ((i * 23) % 100) + '%',
                  animationDelay: -i * 0.43 + 's',
                  animationDuration: 4 + (i % 4) + 's',
                }}
              />
            ))}
          </div>
          {revealed && !isTeam && (
            <div className="gala-celebration" aria-hidden="true">
              {Array.from({ length: 28 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: ((i * 31) % 100) + '%',
                    animationDelay: (i % 7) * 0.12 + 's',
                    backgroundColor: ['#ffe4a0', '#e9b953', '#d9dced'][i % 3],
                  }}
                />
              ))}
            </div>
          )}
          <span className="awards-count">
            {step + 1} / {categories.length}
          </span>
          <h2 id="awards-title">{categories[step]}</h2>
          {isTeam ? (
            <div
              className="awards-pitch awards-formation"
              aria-label="Seleção do ano na formação 4-3-3"
            >
              <svg
                className="award-pitch-markings"
                viewBox="0 0 600 400"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <g
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                >
                  <rect x="12" y="12" width="576" height="376" />
                  <path d="M12 200H588M195 12V74H405V12M250 12V36H350V12M195 388V326H405V388M250 388V364H350V388" />
                  <ellipse cx="300" cy="200" rx="48" ry="42" />
                  <path d="M263 74Q300 110 337 74M263 326Q300 290 337 326" />
                </g>
                <g fill="currentColor">
                  <circle cx="300" cy="200" r="2" />
                  <circle cx="300" cy="56" r="2" />
                  <circle cx="300" cy="344" r="2" />
                </g>
              </svg>
              {[[8, 9, 10], [5, 6, 7], [4, 2, 3, 1], [0]].map((row, rowIndex) => (
                <div className="award-formation-row" key={rowIndex}>
                  {row.map((index) => (
                    <div
                      className={
                        'award-field-player ' +
                        (index < shownPlayers ? 'is-revealed' : 'is-pending')
                      }
                      key={index}
                    >
                      <span className="award-position">{positions[index]}</span>
                      {index < shownPlayers ? (
                        <AwardPerson
                          name={teamCast[index] ?? 'Sem atleta elegível'}
                          index={index}
                          clubName={teamSlots[index]?.clubName}
                        />
                      ) : (
                        <span className="award-player-placeholder">?</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div
              ref={finalists}
              className={'award-finalists ' + (revealed ? 'is-ranked' : 'is-nominating')}
            >
              {candidateOrders[step]!.map((rank) => (
                <div
                  key={rank}
                  data-rank={rank}
                  style={
                    {
                      '--nominee-slot': candidateOrders[step]!.indexOf(rank),
                    } as import('react').CSSProperties
                  }
                  className={'award-finalist ' + (revealed && rank === 0 ? 'is-winner' : '')}
                >
                  <span className="award-rank">
                    {!revealed ? (
                      'FINALISTA'
                    ) : rank === 0 ? (
                      <>
                        <Icon name="trophy" size={22} /> VENCEDOR
                      </>
                    ) : (
                      rank + 1 + 'º LUGAR'
                    )}
                  </span>
                  <AwardPerson
                    name={
                      current
                        ? (current.winners[rank]?.name ?? 'Sem candidato elegível')
                        : isCoach
                          ? ['Eduardo Monteiro', 'Ricardo Martins', 'Paulo Andrade'][rank]!
                          : cast[isKeeper ? rank * 3 : step === 4 ? 9 + rank : 12 - rank]!
                    }
                    index={rank + step}
                    coach={isCoach}
                    clubName={current?.winners[rank]?.clubName}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <footer className="awards-controls">
        <button
          disabled={step === 0}
          onClick={() => {
            setStep(step - 1);
            setShownPlayers(11);
            setRevealed(true);
            setPaused(true);
          }}
        >
          ← Prêmio anterior
        </button>
        <button onClick={() => setPaused(!paused)}>{paused ? 'Continuar' : 'Pausar'}</button>
        <button onClick={next}>
          {isTeam && shownPlayers < 11
            ? 'Revelar próxima posição'
            : !revealed
              ? 'Revelar agora'
              : step === categories.length - 1
                ? 'Encerrar'
                : 'Próximo prêmio →'}
        </button>
      </footer>
    </dialog>
  );
}
