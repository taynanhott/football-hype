import { useState, useEffect, useRef, useCallback } from 'react';
import {
  currentMonthForecast,
  clubPayroll,
  defaultFinancialPlan,
  monthlyFinancialReport,
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
        Tracejado: folha e manutenção mensal. Aumentar a verba salarial reduz a verba de compras.
      </p>
      <p className="financial-budget-note">
        Caixa: {formatMoneyFull(cash)} · Manutenção: {formatMoneyFull(operations)}/mês, sem reserva
        automática. Solte a barra para salvar os limites das negociações.
      </p>
    </section>
  );
}
export function FinancialHistory({ snapshot, club }: Props) {
  const report = monthlyFinancialReport(snapshot.state, club.id, snapshot.ledger);
  const forecast = currentMonthForecast(snapshot.state, club, snapshot.ledger);
  const current = report.current;
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
