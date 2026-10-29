import { GeneratedPerson } from '../../ui/person-avatar';
import {
  clubPayroll,
  financialLimits,
  maintenanceBreakdown,
  monthlyFinancialReport,
} from '@football/domain';
import { clubKit } from '@football/shared';
import { useGameStore } from '../../store/game-store';
import type { ViewProps } from '../../ui/view-props';
import { currency } from '../../ui/format';
import { ClubBadge, Icon } from '../../ui/icons';
import { FinancialManagement, SeasonResults } from './financial-management';
import { FinanceLedger } from './finance-ledger';

function FinancialDirector() {
  return <GeneratedPerson name="Helena Duarte, gestora financeira" outfit="#406f72" />;
}
export function Finance({ snapshot, club }: ViewProps) {
  const state = snapshot.state,
    send = useGameStore((s) => s.send),
    busy = useGameStore((s) => s.busy);

  const costs = maintenanceBreakdown(state, club),
    maintenance = costs.reduce((sum, item) => sum + item.cost, 0),
    payroll = clubPayroll(state, club),
    monthly = maintenance + payroll,
    debt = state.debts[club.id] ?? 0,
    cash = club.balance.cents,
    net = cash - debt,
    projected = net - monthly;
  const report = monthlyFinancialReport(state, club.id, snapshot.ledger),
    limits = financialLimits(state, club),
    coverage = monthly ? Math.max(0, net) / monthly : 0;
  const recentMonths = report.months.slice(-3);
  const recentProfit =
    recentMonths.reduce((sum, month) => sum + month.profit, 0) / Math.max(1, recentMonths.length);
  const status =
    debt > 0 || coverage < 1
      ? 'critical'
      : coverage < 3 || recentProfit < 0
        ? 'warning'
        : 'healthy';
  const health = {
    critical: 'CAIXA EM RISCO',
    warning: 'ATENÇÃO AO ORÇAMENTO',
    healthy: 'CLUBE EQUILIBRADO',
  }[status];
  const biggest = [...costs].sort((a, b) => b.cost - a.cost)[0];
  const tips = [];
  if (debt > 0)
    tips.push('Quite os atrasados antes de contratar. Eles reduzem o rendimento do elenco.');
  if (coverage < 3)
    tips.push(
      'Preserve uma reserva de três meses de folha e manutenção: ' + currency(monthly * 3) + '.',
    );
  if (maintenance > payroll)
    tips.push(
      'A estrutura custa mais que a folha. Reveja níveis ociosos, principalmente ' +
        (biggest?.name ?? 'o estádio') +
        '.',
    );
  if (recentProfit < 0)
    tips.push(
      'O resultado médio dos últimos meses é negativo. Suspenda upgrades e negocie atletas com pouco espaço no elenco.',
    );
  if (limits.salaryCap < payroll)
    tips.push(
      'A folha atual ultrapassa o teto definido. Reorganize o elenco antes de prometer novos salários.',
    );
  if (tips.length < 3)
    tips.push(
      'Revise os ingressos dos próximos mandos: equilibre arrecadação e expectativa de público.',
    );
  if (tips.length < 3)
    tips.push(
      'Uma contratação compromete o caixa hoje e aumenta a folha dos próximos meses. Use a sobra salarial como limite.',
    );
  return (
    <div className="finance-hub">
      <header className="finance-hero">
        <div className="finance-hero-copy">
          <a className="finance-club" href={'#/trophies?club=' + club.id}>
            <ClubBadge name={club.name} kit={clubKit(club)} size={34} />
            {club.name}
          </a>
        </div>
        <div className="finance-hero-balance">
          <span>CAIXA DO CLUBE</span>
          <strong className={net < 0 ? 'negative' : ''}>{currency(cash)}</strong>
          <small className={projected < 0 ? 'negative' : ''}>
            Após as próximas contas: {currency(projected)}
          </small>
        </div>
      </header>
      <div className="finance-scoreboard">
        {[
          { label: 'Folha mensal', value: payroll, note: 'Compromisso com o elenco' },
          { label: 'Estruturas / mês', value: maintenance, note: 'Cada nível tem seu custo' },
          {
            label: 'Contas em atraso',
            value: debt,
            note: debt ? 'Prioridade de pagamento' : 'Sem pendências',
            negative: debt > 0,
          },
          {
            label: 'Fôlego de caixa',
            text: coverage.toFixed(1) + ' meses',
            note: 'Folha + estruturas',
            negative: coverage < 1,
          },
        ].map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong className={item.negative ? 'negative' : ''}>
              {item.text ?? currency(item.value ?? 0)}
            </strong>
            <small>{item.note}</small>
          </article>
        ))}
      </div>
      <section className={'finance-director ' + status}>
        <div className="finance-director-person">
          <FinancialDirector />
          <div>
            <span>DIRETORA FINANCEIRA</span>
            <h2>Helena Duarte</h2>
            <b>{health}</b>
          </div>
        </div>
        <div className="finance-director-advice">
          <h3>
            {status === 'critical'
              ? 'Precisamos proteger o caixa agora.'
              : status === 'warning'
                ? 'Temos margem, mas cada decisão pesa.'
                : 'Seu clube tem espaço para planejar.'}
          </h3>
          <p>
            Hoje, folha e estruturas custam <strong>{currency(monthly)}/mês</strong>.{' '}
            {coverage < 1
              ? 'O caixa não cobre o próximo fechamento.'
              : 'A reserva cobre aproximadamente ' +
                coverage.toFixed(1) +
                ' meses sem novas receitas.'}
          </p>
          <ul>
            {tips.slice(0, 3).map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      </section>
      {(projected < 0 || debt > 0 || report.current.profit < 0) && (
        <section className="finance-alert" role="alert">
          <strong>⚠ Atenção financeira</strong>
          {projected < 0 && (
            <p>
              Sem novas receitas, faltam {currency(-projected)} para cobrir as próximas contas
              mensais.
            </p>
          )}
          {debt > 0 && (
            <p>
              Saldo líquido após dívidas: <b>{currency(net)}</b>. Pendências: {currency(debt)}.
            </p>
          )}
          {report.current.profit < 0 && (
            <p>
              Prejuízo do mês: <b>{currency(report.current.profit)}</b>.
            </p>
          )}
          {debt > 0 && (
            <button
              className="primary"
              disabled={busy || cash < debt}
              onClick={() => send({ type: 'management', action: 'pay-debt' })}
            >
              Quitar pendências
            </button>
          )}
        </section>
      )}
      <FinancialManagement snapshot={snapshot} club={club} />
      <div className="finance-season-operations">
        <SeasonResults snapshot={snapshot} club={club} />
        <section className="panel finance-operations">
          <header className="section-header">
            <div>
              <h2>Custos das estruturas</h2>
            </div>
            <strong>{currency(maintenance)}/mês</strong>
          </header>
          <div className="finance-facility-costs">
            {[...costs]
              .sort((a, b) => b.cost - a.cost)
              .map((item) => (
                <a
                  key={item.target}
                  href={
                    ['fitness', 'medical', 'scouting', 'coaching', 'marketing'].includes(
                      item.target,
                    )
                      ? '#/training'
                      : '#/stadium'
                  }
                >
                  <span className="facility-cost-icon">
                    <Icon
                      name={
                        (
                          {
                            fitness: 'training',
                            medical: 'recovery',
                            scouting: 'search',
                            coaching: 'tactics',
                            marketing: 'megaphone',
                            pitch: 'pitch',
                            capacity: 'stadium',
                            food: 'food',
                            shop: 'shirt',
                            hospitality: 'hospitality',
                            entrance: 'entrance',
                          } as Record<string, string>
                        )[item.target] ?? 'stadium'
                      }
                      size={22}
                    />
                  </span>
                  <span className="facility-cost-name">
                    {item.name}
                    <small>Nv. {item.level}</small>
                  </span>
                  <strong>{currency(item.cost)}</strong>
                </a>
              ))}
          </div>
        </section>
      </div>
      <FinanceLedger snapshot={snapshot} club={club} />
    </div>
  );
}
