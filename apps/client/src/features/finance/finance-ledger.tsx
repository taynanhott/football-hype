import { PlayerModal } from '../players/player-modal';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ViewProps } from '../../ui/view-props';
import { currency } from '../../ui/format';

export function FinanceLedger({ snapshot, club }: Pick<ViewProps, 'snapshot' | 'club'>) {
  const entries = useMemo(
    () =>
      snapshot.ledger
        .filter((entry) => Boolean(entry.balances?.[club.id]))
        .slice()
        .reverse(),
    [snapshot.ledger, club.id],
  );
  const [pageSize, setPageSize] = useState(10);
  const tableRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<'next' | 'previous' | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const pages = Math.max(1, Math.ceil(entries.length / pageSize));
  const current = Math.min(page, pages - 1);
  useEffect(() => {
    const table = tableRef.current;
    if (!open || !table) return;
    const fit = () => {
      const probe = document.createElement('div');
      const descriptionWidth = window.matchMedia('(max-width: 650px)').matches ? 0.49 : 0.54;
      Object.assign(probe.style, {
        position: 'fixed',
        visibility: 'hidden',
        pointerEvents: 'none',
        width: `${Math.max(1, table.clientWidth * descriptionWidth - 14)}px`,
        fontFamily: getComputedStyle(table).fontFamily,
        fontSize: '11px',
        lineHeight: '14px',
        overflowWrap: 'anywhere',
        whiteSpace: 'normal',
      });
      table.append(probe);
      let rowHeight = 32;
      for (const entry of entries) {
        probe.textContent = entry.message;
        rowHeight = Math.max(rowHeight, probe.offsetHeight + 12);
      }
      probe.remove();
      setPageSize(Math.max(1, Math.floor((table.clientHeight - 30) / rowHeight)));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(table);
    fit();
    return () => observer.disconnect();
  }, [open, entries, current, turn]);

  const changePage = (direction: 'next' | 'previous') => {
    if (turn) return;
    setTurn(direction);
    timers.current = [
      window.setTimeout(() => {
        setPage(current + (direction === 'next' ? 1 : -1));
        setTurn(null);
      }, 550),
    ];
  };
  return (
    <>
      <button className="ledger-leather-cover" onClick={() => setOpen(true)}>
        <span>FOOTBALL HYPE · {club.name}</span>
        <strong>
          Livro de
          <br />
          movimentações
        </strong>
        <span>{entries.length} lançamentos · Abrir livro →</span>
      </button>
      {open && (
        <PlayerModal
          title="Livro de movimentações"
          onClose={() => setOpen(false)}
          className="ledger-book-modal"
          hideTitle
        >
          <section className="finance-agenda" aria-label="Livro de movimentações">
            <div className="agenda-binding" aria-hidden="true">
              {Array.from({ length: 7 }, (_, index) => (
                <i key={index} />
              ))}
            </div>
            <div className="agenda-pages" aria-busy={!!turn}>
              {(turn
                ? [turn === 'next' ? current + 1 : current, turn === 'next' ? current : current - 1]
                : [current]
              ).map((sheetPage, layer) => {
                const overlay = !!turn && layer === 1;
                const visible = entries.slice(sheetPage * pageSize, (sheetPage + 1) * pageSize);
                return (
                  <div
                    key={sheetPage}
                    className={`agenda-sheet ${overlay ? `agenda-overlay agenda-turn-${turn}` : ''}`}
                    aria-hidden={overlay}
                    inert={overlay || undefined}
                  >
                    <header className="agenda-heading">
                      <div>
                        <span>CONTROLE DO CLUBE · {club.name}</span>
                        <h2>Livro de movimentações</h2>
                      </div>
                      <span>{entries.length} lançamentos</span>
                    </header>
                    <div className="agenda-table-wrap" ref={overlay ? undefined : tableRef}>
                      <table
                        className="agenda-table"
                        style={{ '--agenda-row-count': pageSize } as CSSProperties}
                      >
                        <thead>
                          <tr>
                            <th>Valor</th>
                            <th>Descrição</th>
                            <th>Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((entry) => {
                            const amount = entry.balances?.[club.id] ?? 0;
                            return (
                              <tr key={entry.id}>
                                <td className={amount >= 0 ? 'agenda-income' : 'agenda-expense'}>
                                  {amount > 0 ? '+' : '−'}
                                  {currency(Math.abs(amount))}
                                </td>
                                <td>{entry.message}</td>
                                <td>
                                  {entry.gameOccurredAt === undefined
                                    ? '—'
                                    : new Intl.DateTimeFormat('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: '2-digit',
                                        timeZone: 'UTC',
                                      }).format(entry.gameOccurredAt)}
                                </td>
                              </tr>
                            );
                          })}
                          {Array.from({ length: pageSize - visible.length }, (_, index) => (
                            <tr
                              className="agenda-blank-row"
                              key={'blank-' + index}
                              aria-hidden="true"
                            >
                              <td />
                              <td />
                              <td />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {
                      <footer className="agenda-footer">
                        <button
                          disabled={current === 0 || !!turn}
                          onClick={() => changePage('previous')}
                          aria-label="Virar para a página anterior"
                        >
                          ← Folha anterior
                        </button>
                        <span aria-live="polite">
                          Folha {sheetPage + 1} de {pages}
                        </span>
                        <button
                          disabled={current === pages - 1 || !!turn}
                          onClick={() => changePage('next')}
                          aria-label="Virar para a próxima página"
                        >
                          Próxima folha →
                        </button>
                      </footer>
                    }
                  </div>
                );
              })}
            </div>
          </section>
        </PlayerModal>
      )}
    </>
  );
}
