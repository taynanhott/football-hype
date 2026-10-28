import { cupReturnDate } from '@football/domain';
import { useLayoutEffect, useRef, useState } from 'react';
import { COMPETITIONS, type WorldState } from '@football/shared';
import { PixelBadge } from '../../ui/pixel-badge';
import { dateTime } from '../../ui/format';

export function CupBracket({
  state,
  competitionId,
  clubId,
}: {
  state: WorldState;
  competitionId: string;
  clubId?: string;
}) {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const gamesRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState({ columns: 3, rows: 4, height: 0 });
  const rule = COMPETITIONS.find((item) => item.id === competitionId);
  const allNodes = state.cups.filter((node) => node.competitionId === competitionId);
  const results = new Map(state.results.map((result) => [result.fixtureId, result]));
  const nodes = allNodes.filter(
    (node) =>
      (node.homeId && node.awayId) || results.has(node.id) || results.has(`${node.id}:first`),
  );
  const rounds = [...new Set(nodes.map((node) => node.round))].sort((a, b) => b - a);
  const allRounds = [...new Set(allNodes.map((node) => node.round))].sort((a, b) => a - b);
  const activeRound =
    selectedRound !== null && rounds.includes(selectedRound) ? selectedRound : rounds.at(-1);
  const roundNodes = nodes.filter((node) => node.round === activeRound);
  const twoLegs = roundNodes.some((node) => (node.legs ?? rule?.legs) === 2);
  const pageSize = Math.max(1, roundNodes.length);
  useLayoutEffect(() => {
    const grid = gamesRef.current;
    if (!grid) return;
    const measure = () => {
      const bounds = grid.getBoundingClientRect();
      const columns = 2;
      const cards = Array.from(grid.children) as HTMLElement[];
      const cardHeight = Math.max(
        twoLegs ? 150 : 80,
        ...cards.map((card) =>
          Array.from(card.children).reduce(
            (sum, child) => sum + child.getBoundingClientRect().height,
            2,
          ),
        ),
      );
      const top = bounds.top + window.scrollY;
      let bottomSpace = 12;
      let ancestor = grid.parentElement;
      while (ancestor && ancestor !== document.body) {
        const computed = getComputedStyle(ancestor);
        bottomSpace +=
          (parseFloat(computed.paddingBottom) || 0) + (parseFloat(computed.borderBottomWidth) || 0);
        if (ancestor.classList.contains('main-content')) break;
        ancestor = ancestor.parentElement;
      }
      const available = Math.max(cardHeight, window.innerHeight - top - bottomSpace);
      const rows = Math.max(1, Math.floor((available + 8) / (cardHeight + 8)));
      setCapacity((previous) =>
        previous.columns === columns &&
        previous.rows === rows &&
        previous.height === Math.floor(available)
          ? previous
          : { columns, rows, height: Math.floor(available) },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activeRound, competitionId, twoLegs, roundNodes.length, capacity.columns]);
  const pages = Math.max(1, Math.ceil(roundNodes.length / pageSize));
  const activePage = Math.min(page, pages - 1);
  const final = Math.max(...allNodes.map((node) => node.round));
  const team = (id: string | null) => {
    const club = state.clubs.byId[id ?? ''];
    return (
      <>
        {club ? (
          <a className="cup-club-link" href={'#/trophies?club=' + club.id}>
            {club.name}
          </a>
        ) : (
          <span>A definir</span>
        )}
        {club && (
          <PixelBadge
            name={club.name}
            {...(club.crestUrl ? { url: club.crestUrl } : {})}
            size={18}
          />
        )}
      </>
    );
  };
  if (!nodes.length && state.competitionNotes?.[competitionId]) return null;
  if (!nodes.length)
    return (
      <div className="cup-stage-empty">
        <h2>Mata-mata</h2>
        <p>
          Os confrontos serão definidos quando a fase de grupos terminar. Os dois primeiros de cada
          grupo avançam.
        </p>
      </div>
    );
  return (
    <div className="cup-bracket-cards">
      <div className="cup-round-navigation" role="group" aria-label="Fase da copa">
        {allRounds.map((round) => (
          <button
            key={round}
            disabled={!nodes.some((node) => node.round === round && node.homeId && node.awayId)}
            title={
              !nodes.some((node) => node.round === round && node.homeId && node.awayId)
                ? 'Confrontos ainda não definidos'
                : undefined
            }
            aria-pressed={round === activeRound}
            className={round === activeRound ? 'selected' : ''}
            onClick={() => {
              setSelectedRound(round);
              setPage(0);
            }}
          >
            {allNodes.find((node) => node.round === round)?.label ??
              ['Final', 'Semifinal', 'Quartas', 'Oitavas'][final - round] ??
              'Fase ' + (round + 1)}
          </button>
        ))}
      </div>
      {rounds
        .filter((round) => round === activeRound)
        .map((round) => {
          const name =
            ['Final', 'Semifinal', 'Quartas de final', 'Oitavas de final'][final - round] ??
            `Fase ${round + 1}`;
          return (
            <section className="cup-round-card" key={round}>
              <h2>
                {nodes.find((node) => node.round === round)?.label ?? name}
                {nodes
                  .filter((node) => node.round === round)
                  .every((node) => (node.legs ?? rule?.legs) === 2)
                  ? ' · Ida e volta'
                  : ' · Jogo único'}
              </h2>
              <div
                className="cup-round-games cup-two-column-screen"
                ref={gamesRef}
                style={{
                  gridTemplateColumns: `repeat(${capacity.columns}, minmax(0, 1fr))`,
                  height: capacity.height || undefined,
                  gridTemplateRows: `repeat(${Math.max(1, Math.ceil(roundNodes.length / 2))}, minmax(0, 1fr))`,
                }}
              >
                {nodes
                  .filter((node) => node.round === round)
                  .slice(activePage * pageSize, (activePage + 1) * pageSize)
                  .map((node) => {
                    const legs =
                      (node.legs ?? rule?.legs) === 2
                        ? [
                            {
                              id: `${node.id}:first`,
                              label: 'Ida',
                              home: node.homeId,
                              away: node.awayId,
                              at: node.scheduledAt,
                            },
                            {
                              id: node.id,
                              label: 'Volta',
                              home: node.awayId,
                              away: node.homeId,
                              at: cupReturnDate(node.competitionId, node.scheduledAt),
                            },
                          ]
                        : [
                            {
                              id: node.id,
                              label: 'Jogo único',
                              home: node.homeId,
                              away: node.awayId,
                              at: node.scheduledAt,
                            },
                          ];
                    return (
                      <div className="cup-tie" key={node.id}>
                        {legs.map((leg) => {
                          const result = results.get(leg.id);
                          const home = result?.homeId ?? leg.home,
                            away = result?.awayId ?? leg.away;
                          const stadium =
                            state.stadiums.byId[state.clubs.byId[home ?? '']?.stadiumId ?? ''];
                          return (
                            <div className="cup-leg" key={leg.id}>
                              <p>
                                {leg.label} ·{' '}
                                <time dateTime={new Date(leg.at).toISOString()}>
                                  {dateTime(leg.at)}
                                </time>
                              </p>
                              <div className="cup-score-row">
                                <div
                                  className={`cup-side cup-side-home ${home === node.winnerId ? 'cup-winner' : ''} ${home === clubId ? 'user-team-outline' : ''}`}
                                >
                                  {team(home)}
                                </div>
                                <strong className="cup-score">
                                  {result ? `${result.homeGoals}–${result.awayGoals}` : '×'}
                                  {result?.penalties && (
                                    <small className="cup-penalties">
                                      {result.penalties.home}–{result.penalties.away} pên
                                    </small>
                                  )}
                                </strong>
                                <div
                                  className={`cup-side cup-side-away ${away === node.winnerId ? 'cup-winner' : ''} ${away === clubId ? 'user-team-outline' : ''}`}
                                >
                                  {team(away)}
                                </div>
                              </div>
                              {stadium && <span className="cup-stadium">{stadium.name}</span>}
                            </div>
                          );
                        })}
                        {node.winnerId && (
                          <p className="cup-qualified">
                            {state.clubs.byId[node.winnerId]?.name}{' '}
                            {round === final ? 'campeão' : 'classificado'}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
              {pages > 1 && (
                <div className="cup-page-controls">
                  <button disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>
                    ← Anterior
                  </button>
                  <span>
                    {activePage + 1} / {pages}
                  </span>
                  <button
                    disabled={activePage + 1 === pages}
                    onClick={() => setPage(activePage + 1)}
                  >
                    Próximos →
                  </button>
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
