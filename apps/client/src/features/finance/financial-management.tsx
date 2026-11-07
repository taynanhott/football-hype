import { useState, useEffect, useRef, useCallback } from 'react';
import {
  currentMonthForecast,
  clubPayroll,
  defaultFinancialPlan,
  monthlyFinancialReport,
  maintenanceBreakdown,
  monthlyStructureCost,
  seasonFinancialReport,
} from '@football/domain';
import {
  MONEY_STEPS,
  formatMoneyFull,
  type ClubSnapshot,
  type GameSnapshot,
} from '@football/shared';
import { useGameStore } from '../../store/game-store';
import { currency } from '../../ui/format';
import { TicketPricing } from './ticket-pricing';

const COLORS = {
  transfer: '#7bda78',
  salary: '#e6b45b',
  reserve: '#59778d',
  income: '#428cb8',
  expenses: '#d37a65',
  fixed: '#9b83ad',
  profit: '#258660',
};
const compact = currency;
type Props = { snapshot: GameSnapshot; club: ClubSnapshot };
export function FinancialManagement(props: Props) {
  return (
    <div className="finance-management-grid">
      <BudgetEditor key={props.club.id} {...props} />
      <TicketPricing state={props.snapshot.state} clubId={props.club.id} />
      <FinancialHistory {...props} />
    </div>
  );
}
export function BudgetEditor({ snapshot, club }: Props) {
  const state = snapshot.state;
  const cash = Math.max(0, club.balance.cents);
  const operations = monthlyStructureCost(state, club);
  const budgetStep = MONEY_STEPS.general;
  const total = Math.floor(cash / budgetStep) * budgetStep;
  const plan = state.management?.financialPlans?.[club.id];
  const payroll = clubPayroll(state, club);
  const monthlyExpenses = payroll + operations;
  const savedSalaries = plan?.salaries ?? defaultFinancialPlan(state, club).salaries;
  const [draftSalaries, setSalaries] = useState<number | null>(null);
  // Release the local edit only after the plan reflects the selected amount.
  if (draftSalaries !== null && savedSalaries === draftSalaries) setSalaries(null);
  const salaries =
    Math.floor(Math.max(0, Math.min(total, draftSalaries ?? savedSalaries)) / budgetStep) *
    budgetStep;
  const transfer = Math.floor(Math.max(0, total - salaries) / budgetStep) * budgetStep;
  const busy = useGameStore((s) => s.busy);
  const send = useGameStore((s) => s.send);
  const submitted = useRef('');
  const editedValue = useRef<number | null>(null);
  const share = total ? (salaries / total) * 100 : 0;
  const costShare = total ? Math.min(100, (monthlyExpenses / total) * 100) : 0;
  const commit = useCallback(() => {
    if (editedValue.current === null) return;
    let value = editedValue.current;
    value = Math.floor(Math.max(0, Math.min(total, value)) / budgetStep) * budgetStep;
    const purchases = Math.floor(Math.max(0, total - value) / budgetStep) * budgetStep;
    const signature = `${value}:${purchases}`;
    if (
      busy ||
      submitted.current === signature ||
      (plan?.salaries === value && plan.transfer === purchases)
    )
      return;
    editedValue.current = null;
    if (send({ type: 'financial-plan', salaries: value, transfer: purchases })) {
      submitted.current = signature;
    } else editedValue.current = value;
  }, [busy, total, budgetStep, plan, send]);
  useEffect(() => {
    const finish = () => commit();
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      finish();
    };
  }, [commit]);
  return (
    <section className="panel financial-budget split-budget">
      <header className="section-header">
        <div>
          <span className="eyebrow">ORÇAMENTO DO TIME</span>
          <h2>{formatMoneyFull(total)}</h2>
        </div>
        <span className="split-budget-hint">{busy ? 'Salvando…' : 'Arraste para dividir'}</span>
      </header>
      <div className="split-budget-track">
        <div className="split-budget-salary" style={{ width: `${share}%` }} />
        <div className="split-budget-cost" style={{ width: `${costShare}%` }} />
        <span
          className="split-budget-marker"
          style={{ left: `${costShare}%` }}
          title={`Despesa mensal total: ${formatMoneyFull(monthlyExpenses)}`}
        />
        <input
          type="range"
          min={0}
          max={total}
          step={budgetStep}
          value={salaries}
          disabled={busy || total === 0}
          aria-label="Dividir orçamento entre salários e compras"
          aria-valuetext={`${formatMoneyFull(salaries)} para salários por mês e ${formatMoneyFull(transfer)} para compras`}
          onChange={(e) => {
            submitted.current = '';
            editedValue.current = Number(e.target.value);
            setSalaries(Number(e.target.value));
          }}
          onPointerUp={commit}
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
              commit();
          }}
          onBlur={commit}
        />
      </div>
      <div className="split-budget-labels">
        <strong>Salários {formatMoneyFull(salaries)}/mês</strong>
        <strong>Compras {formatMoneyFull(transfer)}</strong>
      </div>
      <div className="split-budget-summary">
        <span>
          Despesa mensal total <strong>{formatMoneyFull(monthlyExpenses)}</strong>
        </span>
        <span className={salaries < monthlyExpenses ? 'negative' : ''}>
          {salaries < monthlyExpenses
            ? `Faltam ${formatMoneyFull(monthlyExpenses - salaries)} para as despesas`
            : `Folga ${formatMoneyFull(salaries - monthlyExpenses)}/mês`}
        </span>
      </div>
      <p className="financial-budget-note">
        A área tracejada indica salários e manutenção mensal das estruturas. Mais espaço para
        salários deixa menos dinheiro para contratações.
      </p>
      <p className="financial-budget-note">
        Caixa total: {formatMoneyFull(cash)} · Estruturas e dívidas previstas:{' '}
        {formatMoneyFull(operations)} (sem reserva automática). A divisão é salva ao soltar a barra
        e aplicada às negociações.
      </p>
    </section>
  );
}
export function FinancialHistory({ snapshot, club }: Props) {
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
  const forecast = currentMonthForecast(snapshot.state, club, snapshot.ledger);
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
    height = 160,
    top = 20,
    bottom = 130,
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
          <h2>Evolução financeira mensal</h2>
        </div>
      </header>
      <div className="financial-insights-metrics">
        {[
          { label: 'Total arrecadado', value: report.income },
          { label: 'Estimativa de lucro do mês atual', value: forecast.profit },
          { label: 'Gasto no mês atual', value: current.expenses },
          { label: 'Lucro no mês atual', value: current.profit },
          { label: 'Lucro do mês passado', value: report.previous?.profit ?? 0 },
          { label: 'Lucro médio por mês', value: report.averageProfit },
        ].map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong
              className={
                metric.value < 0 || metric.label === 'Gasto no mês atual' ? 'negative' : ''
              }
              title={currency(metric.value)}
            >
              {compact(metric.value)}
            </strong>
          </div>
        ))}
      </div>
      <p className="financial-budget-note">
        Estimativa: receitas registradas, público previsto por partida, participação na bilheteria,
        patrocínios e custos do mês. Média de público:{' '}
        <strong>{forecast.averageAttendance.toLocaleString('pt-BR')}</strong>; ingresso médio:{' '}
        <strong>{currency(forecast.averageTicketPrice)}</strong>. Considera os jogos conhecidos no
        calendário e os preços atuais. Custo fixo mensal atual: <strong>{currency(fixed)}</strong>.
        Média calculada desde o início da carreira, incluindo meses sem movimentação e excluindo o
        mês atual.
      </p>
      {months.some(
        (month) => month.income || month.expenses || month.fixedCosts || month.profit,
      ) ? (
        <>
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
                    <text x={center} y="150" textAnchor="middle" fill="#536d5b" fontSize="12">
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
        </>
      ) : (
        <p className="financial-empty">Sem movimentações no período.</p>
      )}
      {report.legacy && (
        <p className="financial-budget-note">
          Movimentações antigas usam a variação líquida do caixa. Os novos registros separam
          receitas e pagamentos.
        </p>
      )}
    </section>
  );
}
export function SeasonResults({ snapshot, club }: Props) {
  const report = seasonFinancialReport(snapshot.state, club.id, snapshot.ledger);
  const maximum = Math.max(1, report.income, report.expenses);
  return (
    <section className="panel financial-season-compact">
      <h2>
        Entrou × saiu <small>· {snapshot.state.season}</small>
      </h2>
      <div className="season-inline-bars">
        {[
          { label: 'Entrou', value: report.income, color: COLORS.income },
          { label: 'Saiu', value: report.expenses, color: COLORS.expenses },
        ].map((row) => (
          <div key={row.label}>
            <span>{row.label}</span>
            <div className="season-inline-track">
              <i style={{ width: (row.value / maximum) * 100 + '%', background: row.color }} />
            </div>
            <strong>{currency(row.value)}</strong>
          </div>
        ))}
      </div>
      <span>
        Saldo{' '}
        <strong className={report.profit < 0 ? 'negative' : 'positive'}>
          {currency(report.profit)}
        </strong>
      </span>
    </section>
  );
}
