import { GeneratedPerson } from '../../ui/person-avatar';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { COMPETITIONS, type WorldState } from '@football/shared';
import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { PixelBadge } from '../../ui/pixel-badge';
import { dateTime } from '../../ui/format';
import { Icon } from '../../ui/icons';
export type CompetitionDraw = NonNullable<WorldState['competitionDraws']>[number];
function DrawAvatar({ player = false }: { player?: boolean }) {
  return (
    <GeneratedPerson
      name={player ? 'Atleta convidado' : 'Apresentador do sorteio'}
      className={`ceremony-avatar ${player ? 'ceremony-player' : ''}`}
      outfit={player ? '#d4bd4b' : '#263f34'}
    />
  );
}
export function CompetitionDrawDetails({
  state,
  draw,
  onClose,
}: {
  state: WorldState;
  draw: CompetitionDraw;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => openModalPreservingScroll(dialog.current), []);
  const completed = draw.completedAt !== undefined;
  const entries = useMemo<
    { id: string; homeId: string; awayId: string | null; group: string | undefined }[]
  >(() => {
    if (!completed) return [];
    if (draw.kind === 'groups')
      return draw.participantIds.map((id) => {
        const fixture = state.fixtures.find(
          (f) => f.competitionId === draw.competitionId && (f.homeId === id || f.awayId === id),
        );
        return {
          id,
          homeId: id,
          awayId: null,
          group: fixture?.homeId === id ? fixture.group : (fixture?.awayGroup ?? fixture?.group),
        };
      });
    return state.cups
      .filter(
        (n) => n.competitionId === draw.competitionId && n.round === 0 && n.homeId && n.awayId,
      )
      .map((n) => ({ id: n.id, homeId: n.homeId!, awayId: n.awayId, group: undefined }));
  }, [completed, draw.kind, draw.participantIds, draw.competitionId, state.fixtures, state.cups]);
  const [revealed, setRevealed] = useState(0);
  const [running, setRunning] = useState(completed);
  const [speed, setSpeed] = useState(1);
  const [page, setPage] = useState(0);
  const [groupPage, setGroupPage] = useState(0);
  const finished = completed && revealed >= entries.length;
  const groups = useMemo(
    () => [...new Set(entries.map((e) => e.group).filter((g): g is string => Boolean(g)))].sort(),
    [entries],
  );
  const name = COMPETITIONS.find((r) => r.id === draw.competitionId)?.name ?? draw.competitionId;
  const pages = Math.max(
    1,
    Math.ceil((completed ? entries.length : draw.participantIds.length) / (completed ? 4 : 8)),
  );
  const active = revealed ? entries[Math.min(revealed, entries.length) - 1] : undefined;
  useEffect(() => {
    if (!running || finished || !completed) return;
    const timer = setTimeout(
      () => {
        const next = Math.min(revealed + 1, entries.length);
        setRevealed(next);
        setPage(Math.max(0, Math.floor((next - 1) / 4)));
        const group = entries[next - 1]?.group;
        if (group) setGroupPage(Math.max(0, groups.indexOf(group)));
      },
      (draw.kind === 'groups' ? 1500 : 2200) / speed,
    );
    return () => clearTimeout(timer);
  }, [running, finished, completed, revealed, entries, speed, draw.kind, groups]);
  const club = (id: string, large = false) => (
    <span className={`ceremony-club ${large ? 'ceremony-club-large' : ''}`} key={id}>
      <PixelBadge
        name={state.clubs.byId[id]?.name ?? 'Clube'}
        {...(state.clubs.byId[id]?.crestUrl ? { url: state.clubs.byId[id]!.crestUrl! } : {})}
        size={large ? 42 : 22}
      />
      <strong>{state.clubs.byId[id]?.name ?? 'Clube'}</strong>
    </span>
  );
  const skip = () => {
    setRevealed(entries.length);
    setRunning(false);
    setPage(Math.max(0, pages - 1));
  };
  const speech = !completed
    ? 'Os clubes estão confirmados. Voltamos na data marcada!'
    : finished
      ? 'Tudo definido. Que vença o melhor futebol!'
      : !revealed
        ? 'Está aberto o sorteio. Vamos ao primeiro nome!'
        : draw.kind === 'groups'
          ? `${state.clubs.byId[active?.homeId ?? '']?.name ?? 'Clube'} no grupo ${active?.group ?? ''}!`
          : `Confronto ${revealed} definido. Vamos ao próximo!`;
  return (
    <dialog
      ref={dialog}
      className={`competition-draw-modal draw-ceremony ${running && !finished ? 'is-drawing' : ''}`}
      aria-labelledby="draw-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) {
          const b = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < b.left ||
            event.clientX > b.right ||
            event.clientY < b.top ||
            event.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <header className="ceremony-header">
        <div>
          <span className="eyebrow">
            <Icon name="trophy" size={15} /> SORTEIO
          </span>
          <h2 id="draw-title">{name}</h2>
          <time dateTime={new Date(draw.scheduledAt).toISOString()}>
            {dateTime(draw.scheduledAt)}
          </time>
        </div>
        <div className="ceremony-controls">
          {completed && (
            <>
              <button
                onClick={() => setSpeed(speed === 1 ? 2 : 1)}
                aria-label={`Velocidade ${speed} vezes`}
              >
                ×{speed}
              </button>
              <button
                onClick={() => {
                  if (finished) {
                    setRevealed(0);
                    setPage(0);
                    setGroupPage(0);
                  }
                  setRunning(!running || finished);
                }}
              >
                {finished ? 'Rever' : running ? 'Pausar' : 'Continuar'}
              </button>
              {!finished && <button onClick={skip}>Pular</button>}
            </>
          )}
          <button onClick={onClose} aria-label="Fechar sorteio">
            ×
          </button>
        </div>
      </header>
      <section className="ceremony-stage" aria-label="Apresentação do sorteio">
        <DrawAvatar />
        <div className="ceremony-centre">
          <p className="ceremony-speech" aria-live="polite">
            {speech}
          </p>
          {active ? (
            <div className="ceremony-reveal" key={active.id}>
              {club(active.homeId, true)}
              <b>{draw.kind === 'groups' ? `GRUPO ${active.group}` : '×'}</b>
              {active.awayId && club(active.awayId, true)}
            </div>
          ) : (
            <div className="ceremony-globe" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <i key={i} style={{ '--ball': i } as CSSProperties} />
              ))}
            </div>
          )}
        </div>
        <DrawAvatar player />
      </section>
      <div className="ceremony-progress">
        <span>
          {completed
            ? finished
              ? 'Sorteio concluído'
              : `${revealed} de ${entries.length} ${draw.kind === 'groups' ? 'clubes distribuídos' : 'confrontos'}`
            : `${draw.participantIds.length} clubes confirmados`}
        </span>
        {completed && (
          <progress
            value={revealed}
            max={Math.max(1, entries.length)}
            aria-label="Progresso do sorteio"
          />
        )}
      </div>
      <div className="ceremony-results">
        {!completed ? (
          <div className="ceremony-entrants">
            {draw.participantIds.slice(page * 8, page * 8 + 8).map((id) => club(id))}
          </div>
        ) : draw.kind === 'groups' ? (
          <div className="ceremony-groups">
            {groups.map((group, index) => (
              <section key={group} className={index === groupPage ? 'is-active-group' : ''}>
                <h3>Grupo {group}</h3>
                {entries
                  .filter((e) => e.group === group)
                  .map((e) => (
                    <div className="ceremony-group-slot" key={e.id}>
                      {entries.indexOf(e) < revealed ? (
                        club(e.homeId)
                      ) : (
                        <span className="ceremony-placeholder">Aguardando clube</span>
                      )}
                    </div>
                  ))}
              </section>
            ))}
          </div>
        ) : (
          <div className="ceremony-ties">
            {entries.slice(page * 4, page * 4 + 4).map((e, index) => (
              <div className="ceremony-tie" key={e.id}>
                <small>{String(page * 4 + index + 1).padStart(2, '0')}</small>
                {page * 4 + index < revealed ? (
                  <>
                    <div className="ceremony-tie-home">{club(e.homeId)}</div>
                    <b className="ceremony-tie-versus" aria-label="contra">
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                        <path
                          d="m4 4 8 8M12 4l-8 8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </b>
                    <div className="ceremony-tie-away">{e.awayId && club(e.awayId)}</div>
                  </>
                ) : (
                  <>
                    <span className="ceremony-placeholder">A definir</span>
                    <b className="ceremony-tie-versus" aria-label="contra">
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                        <path
                          d="m4 4 8 8M12 4l-8 8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </b>
                    <span className="ceremony-placeholder">A definir</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <footer className="ceremony-footer">
        <span>
          {completed
            ? `${Math.max(0, draw.participantIds.length - (draw.kind === 'groups' ? revealed : revealed * 2))} clubes no globo`
            : 'Aguardando a data do sorteio'}
        </span>
        {completed && draw.kind === 'groups' ? (
          <nav aria-label="Grupos do sorteio">
            <button
              disabled={groupPage === 0}
              onClick={() => {
                setRunning(false);
                setGroupPage(groupPage - 1);
              }}
            >
              ‹
            </button>
            <span>Grupo {groups[groupPage] ?? '—'}</span>
            <button
              disabled={groupPage >= groups.length - 1}
              onClick={() => {
                setRunning(false);
                setGroupPage(groupPage + 1);
              }}
            >
              ›
            </button>
          </nav>
        ) : (
          <nav aria-label="Páginas do sorteio">
            <button
              disabled={page === 0}
              onClick={() => {
                setRunning(false);
                setPage(page - 1);
              }}
            >
              ‹
            </button>
            <span>
              {page + 1} / {pages}
            </span>
            <button
              disabled={page >= pages - 1}
              onClick={() => {
                setRunning(false);
                setPage(page + 1);
              }}
            >
              ›
            </button>
          </nav>
        )}
      </footer>
    </dialog>
  );
}
export function CompetitionDrawCard({ state, draw }: { state: WorldState; draw: CompetitionDraw }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className="panel draw-pending-card">
        <Icon name="trophy" size={24} />
        <h2>{draw.kind === 'groups' ? 'Sorteio dos grupos' : 'Sorteio dos confrontos'}</h2>
        <p>
          {dateTime(draw.scheduledAt)} · {draw.participantIds.length} participantes
        </p>
        {['libertadores', 'sul-americana'].includes(draw.competitionId) && (
          <p>As vagas da pré-Libertadores serão definidas antes do sorteio.</p>
        )}
        <button className="primary" onClick={() => setOpen(true)}>
          Ver participantes e sorteio
        </button>
      </section>
      {open && <CompetitionDrawDetails state={state} draw={draw} onClose={() => setOpen(false)} />}
    </>
  );
}
