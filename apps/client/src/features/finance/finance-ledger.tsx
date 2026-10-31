import { PlayerModal } from '../players/player-modal';
import { useEffect, useRef, useState } from 'react';
import type { ViewProps } from '../../ui/view-props';
import { currency } from '../../ui/format';

const PAGE_SIZE = 10;

export function FinanceLedger({ snapshot, club }: Pick<ViewProps, 'snapshot' | 'club'>) {
  const entries = snapshot.ledger
    .filter((entry) => Boolean(entry.balances?.[club.id]))
    .slice()
    .reverse();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<'next' | 'previous' | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);

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
                const visible = entries.slice(sheetPage * PAGE_SIZE, (sheetPage + 1) * PAGE_SIZE);
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
                    <div className="agenda-table-wrap">
                      <table className="agenda-table">
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
                        </tbody>
                      </table>
                    </div>
                    {!entries.length && (
                      <div className="ledger-empty-state" role="status">
                        <span aria-hidden="true">✦</span>
                        <strong>O próximo capítulo ainda vai começar</strong>
                        <p>As entradas e saídas do clube serão registradas aqui.</p>
                        <small>Nenhuma movimentação até o momento</small>
                      </div>
                    )}
                    {pages > 1 && (
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
                    )}
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
