import { useState, useEffect, useRef } from 'react';
import {
  clubPayroll,
  monthlyFinancialReport,
  maintenanceBreakdown,
  monthlyStructureCost,
  seasonFinancialReport,
} from '@football/domain';
import { MONEY_STEPS, type ClubSnapshot, type GameSnapshot } from '@football/shared';
import { useGameStore } from '../../store/game-store';
import { currency } from '../../ui/format';

const COLORS = {
  transfer: '#7bda78',
  salary: '#e6b45b',
  reserve: '#59778d',
  income: '#428cb8',
  expenses: '#d37a65',
  fixed: '#9b83ad',
  profit: '#258660',
};
const compact = (cents: number) =>
  new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
type Props = { snapshot: GameSnapshot; club: ClubSnapshot };
export function FinancialManagement(props: Props) {
  const plan = props.snapshot.state.management?.financialPlans?.[props.club.id];
  return (
    <>
      <BudgetEditor
        key={`${props.club.id}:${props.club.balance.cents}:${plan?.transfer}:${plan?.salaries}`}
        {...props}
      />
      <FinancialHistory {...props} />
      <SeasonResults {...props} />
    </>
  );
}
function BudgetEditor({ snapshot, club }: Props) {
  const state = snapshot.state;
  const cash = Math.max(0, club.balance.cents);
  const operations = monthlyStructureCost(state, club);
  const total = cash;
  const plan = state.management?.financialPlans?.[club.id];
  const payroll = clubPayroll(state, club);
  const monthlyExpenses = payroll + operations;
  const [salaries, setSalaries] = useState(Math.min(total, plan?.salaries ?? payroll));
  const transfer =
    Math.floor(Math.max(0, total - salaries) / MONEY_STEPS.general) * MONEY_STEPS.general;
  const busy = useGameStore((s) => s.busy);
  const send = useGameStore((s) => s.send);
  const submitted = useRef('');
  const share = total ? (salaries / total) * 100 : 0;
  const costShare = total ? Math.min(100, (monthlyExpenses / total) * 100) : 0;
  function commit(value: number) {
    const purchases =
      Math.floor(Math.max(0, total - value) / MONEY_STEPS.general) * MONEY_STEPS.general;
    const signature = `${value}:${purchases}`;
    if (
      busy ||
      submitted.current === signature ||
      (plan?.salaries === value && plan.transfer === purchases)
    )
      return;
    submitted.current = signature;
    send({ type: 'financial-plan', salaries: value, transfer: purchases });
  }
  return (
    <section className="panel financial-budget split-budget">
      <header className="section-header">
        <div>
          <span className="eyebrow">ORÇAMENTO DO TIME</span>
          <h2>{currency(total)}</h2>
        </div>
        <span className="split-budget-hint">{busy ? 'Salvando…' : 'Arraste para dividir'}</span>
      </header>
      <div className="split-budget-track">
        <div className="split-budget-salary" style={{ width: `${share}%` }} />
        <div className="split-budget-cost" style={{ width: `${costShare}%` }} />
        <span
          className="split-budget-marker"
          style={{ left: `${costShare}%` }}
          title={`Despesa mensal total: ${currency(monthlyExpenses)}`}
        />
        <input
          type="range"
          min={0}
          max={total}
          step={1}
          value={salaries}
          disabled={busy || total === 0}
          aria-label="Dividir orçamento entre salários e compras"
          aria-valuetext={`${currency(salaries)} para salários por mês e ${currency(transfer)} para compras`}
          onChange={(e) => {
            submitted.current = '';
            setSalaries(Number(e.target.value));
          }}
          onPointerUp={(e) => commit(Number(e.currentTarget.value))}
          onKeyUp={(e) => {
            if (
              [
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'ArrowDown',
                'Home',
                'End',
                'PageUp',
                'PageDown',
              ].includes(e.key)
            )
              commit(Number(e.currentTarget.value));
          }}
          onBlur={(e) => commit(Number(e.currentTarget.value))}
        />
      </div>
      <div className="split-budget-labels">
        <strong>Salários {currency(salaries)}/mês</strong>
        <strong>Compras {currency(transfer)}</strong>
      </div>
      <div className="split-budget-summary">
        <span>
          Despesa mensal total <strong>{currency(monthlyExpenses)}</strong>
        </span>
        <span className={salaries < monthlyExpenses ? 'negative' : ''}>
          {salaries < monthlyExpenses
            ? `Faltam ${currency(monthlyExpenses - salaries)} para as despesas`
            : `Folga ${currency(salaries - monthlyExpenses)}/mês`}
        </span>
      </div>
      <p className="financial-budget-note">
        A área tracejada indica salários e manutenção mensal das estruturas. Mais espaço para
        salários deixa menos dinheiro para contratações.
      </p>
      <p className="financial-budget-note">
        Caixa total: {currency(cash)} · Estruturas e dívidas previstas: {currency(operations)} (sem
        reserva automática). A divisão é salva ao soltar a barra e aplicada às negociações.
      </p>
    </section>
  );
}
function FinancialHistory({ snapshot, club }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(720);
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setChartWidth(Math.round(width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const report = monthlyFinancialReport(snapshot.state, club.id, snapshot.ledger);
  const months = report.months.slice(-12),
    current = report.current;
  const fixed =
    clubPayroll(snapshot.state, club) +
    maintenanceBreakdown(snapshot.state, club).reduce((sum, item) => sum + item.cost, 0);
  const highest = Math.max(
      1,
      ...months.flatMap((r) => [r.income, r.expenses, r.fixedCosts, Math.max(0, r.profit)]),
    ),
    lowest = Math.min(0, ...months.map((r) => r.profit));
  const width = Math.max(560, chartWidth, months.length * 66 + 70),
    height = 300,
    top = 20,
    bottom = 250,
    plot = bottom - top;
  const y = (value: number) => top + ((highest - value) / (highest - lowest)) * plot,
    zero = y(0),
    group = (width - 80) / Math.max(1, months.length),
    bar = Math.min(12, group / 5);
  const series = [
    { key: 'income' as const, label: 'Receitas', color: COLORS.income },
    { key: 'expenses' as const, label: 'Despesas pagas', color: COLORS.expenses },
    { key: 'fixedCosts' as const, label: 'Custo fixo do mês', color: COLORS.fixed },
    { key: 'profit' as const, label: 'Lucro / prejuízo', color: COLORS.profit },
  ];
  return (
    <section className="panel financial-history">
      <header className="section-header">
        <div>
          <span className="eyebrow">RESULTADO DO CLUBE</span>
          <h2>Evolução financeira mensal</h2>
          <p>Entradas e saídas do caixa; custo fixo inclui salários e manutenção.</p>
        </div>
      </header>
      <div className="financial-insights-metrics">
        {[
          { label: 'Total arrecadado', value: report.income },
          { label: 'Total gasto', value: report.expenses },
          { label: 'Gasto no mês atual', value: current.expenses },
          { label: 'Lucro no mês atual', value: current.profit },
          { label: 'Lucro médio por mês', value: report.averageProfit },
        ].map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong className={metric.value < 0 ? 'negative' : ''} title={currency(metric.value)}>
              {compact(metric.value)}
            </strong>
          </div>
        ))}
      </div>
      <p className="financial-budget-note">
        Custo fixo mensal atual: <strong>{currency(fixed)}</strong>. Média calculada desde o início
        da carreira, incluindo meses sem movimentação e o mês atual.
      </p>
      <div className="financial-chart-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="financial-chart-scroll" ref={chartRef}>
        <svg
          className="financial-bars"
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: width }}
          role="img"
          aria-label="Gráfico mensal de receitas, despesas, custo fixo e lucro"
        >
          {[0, 0.5, 1].map((t) => {
            const value = lowest + (highest - lowest) * t;
            return (
              <g key={t}>
                <line x1="65" x2={width - 10} y1={y(value)} y2={y(value)} stroke="#e3eae3" />
                <text x="58" y={y(value) + 4} textAnchor="end" fill="#728174" fontSize="11">
                  {compact(value)}
                </text>
              </g>
            );
          })}
          <line x1="65" x2={width - 10} y1={zero} y2={zero} stroke="#829b89" />
          {months.map((month, index) => {
            const center = 70 + group * (index + 0.5);
            return (
              <g key={month.month}>
                {series.map((item, j) => {
                  const value = month[item.key],
                    point = y(value);
                  return (
                    <rect
                      key={item.key}
                      x={center + (j - 2) * bar}
                      y={Math.min(point, zero)}
                      width={bar - 2}
                      height={Math.abs(point - zero)}
                      rx="2"
                      fill={value < 0 ? '#b85043' : item.color}
                    >
                      <title>
                        {month.month} · {item.label}: {currency(value)}
                      </title>
                    </rect>
                  );
                })}
                <text x={center} y="275" textAnchor="middle" fill="#536d5b" fontSize="12">
                  {new Date(month.month + '-02T12:00:00Z').toLocaleDateString('pt-BR', {
                    month: 'short',
                    year: '2-digit',
                    timeZone: 'America/Sao_Paulo',
                  })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {report.legacy && (
        <p className="financial-budget-note">
          Movimentações antigas usam a variação líquida do caixa. Os novos registros separam
          receitas e pagamentos.
        </p>
      )}
      <details className="financial-data-table">
        <summary>Ver valores por mês</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mês</th>
                <th>Receitas</th>
                <th>Despesas pagas</th>
                <th>Custo fixo</th>
                <th>Lucro</th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>{currency(row.income)}</td>
                  <td>{currency(row.expenses)}</td>
                  <td>{currency(row.fixedCosts)}</td>
                  <td className={row.profit < 0 ? 'negative' : 'positive'}>
                    {currency(row.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
function SeasonResults({ snapshot, club }: Props) {
  const report = seasonFinancialReport(snapshot.state, club.id, snapshot.ledger),
    maximum = Math.max(1, report.income, report.expenses);
  return (
    <section className="panel financial-season">
      <header className="section-header">
        <div>
          <span className="eyebrow">BALANÇO DA TEMPORADA</span>
          <h2>Entrou × saiu · {snapshot.state.season}</h2>
          <p>Todas as movimentações de caixa desta temporada.</p>
        </div>
        <strong className={report.profit < 0 ? 'negative' : 'season-profit'}>
          Saldo {currency(report.profit)}
        </strong>
      </header>
      <div
        className="season-money-bars"
        role="img"
        aria-label={
          'Receitas ' + currency(report.income) + ', despesas ' + currency(report.expenses)
        }
      >
        {[
          { label: 'Dinheiro ganho', value: report.income, color: COLORS.income },
          { label: 'Dinheiro gasto', value: report.expenses, color: COLORS.expenses },
        ].map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <div className="season-bar-track">
              <i style={{ width: (row.value / maximum) * 100 + '%', background: row.color }} />
            </div>
            <strong>{currency(row.value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
