import { useLayoutEffect, useRef } from 'react';
import { TicketPricing } from './ticket-pricing';
import { GeneratedPerson } from '../../ui/person-avatar';
import {
  clubPayroll,
  financialLimits,
  maintenanceBreakdown,
  monthlyFinancialReport,
} from '@football/domain';
import { clubKit, formatMoneyFull } from '@football/shared';
import { useGameStore } from '../../store/game-store';
import type { ViewProps } from '../../ui/view-props';
import { currency } from '../../ui/format';
import { ClubBadge, Icon } from '../../ui/icons';
import { BudgetEditor, FinancialHistory, SeasonResults } from './financial-management';
import { FinanceLedger } from './finance-ledger';

function FinancialDirector() {
  return <GeneratedPerson name="Helena Duarte, gestora financeira" outfit="#406f72" />;
}
export function Finance({ snapshot, club }: ViewProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let frame = 0;
    let fitting = false;
    let disposed = false;
    const fit = () => {
      if (fitting) return;
      fitting = true;
      const applyScale = (value: number) => {
        panel.style.zoom = String(value);
        panel.style.setProperty('--finance-scale', String(value));
      };
      applyScale(1);
      if (window.innerWidth >= 1100) {
        const available = Math.max(
          100,
          window.innerHeight -
            panel.getBoundingClientRect().top -
            Math.max(
              24,
              parseFloat(
                getComputedStyle(panel.closest('.main-content') ?? panel.parentElement!)
                  .paddingBottom,
              ) + 8,
            ),
        );
        if (panel.getBoundingClientRect().height > available + 1) {
          let low = 0.3,
            high = 1;
          for (let attempt = 0; attempt < 8; attempt++) {
            const mid = (low + high) / 2;
            applyScale(mid);
            if (panel.getBoundingClientRect().height > available + 1) high = mid;
            else low = mid;
          }
          applyScale(low);
        }
      }
      fitting = false;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(panel, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    window.addEventListener('resize', schedule);
    panel.addEventListener('load', schedule, true);
    // Font metrics must be settled before revealing the fitted desktop panel.
    if (window.innerWidth >= 1100 && document.fonts.status !== 'loaded') {
      panel.style.visibility = 'hidden';
      document.fonts.ready.then(() => {
        if (disposed) return;
        fit();
        panel.style.visibility = '';
      });
    } else {
      fit();
    }
    return () => {
      disposed = true;
      panel.style.visibility = '';
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      panel.removeEventListener('load', schedule, true);
    };
  }, []);
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
  const stadium = state.stadiums.byId[club.stadiumId];
  const attraction: Record<string, number> = {
    pitch: (stadium?.pitchLevel ?? 0) * 2,
    surroundings: (stadium?.surroundingsLevel ?? 0) * 3,
    structure: stadium?.sectors.length
      ? (stadium.sectors.reduce((sum, sector) => sum + sector.level, 0) / stadium.sectors.length) *
        2
      : 0,
  };
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
    <div ref={panelRef} className="finance-hub finance-equal-columns">
      <div className="finance-fill-column finance-fill-overview">
        <header className="finance-hero">
          <div className="finance-hero-copy">
            <a className="finance-club" href={'#/trophies?club=' + club.id}>
              <ClubBadge name={club.name} kit={clubKit(club)} size={144} />
              {club.name}
            </a>
          </div>
          <div className="finance-hero-balance">
            <span>CAIXA DO CLUBE</span>
            <strong className={net < 0 ? 'negative' : ''}>{formatMoneyFull(cash)}</strong>
            <small className={projected < 0 ? 'negative' : ''}>
              Após as próximas contas: {formatMoneyFull(projected)}
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
              text: coverage.toFixed(1).replace('.', ',') + ' meses',
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
        <SeasonResults snapshot={snapshot} club={club} />
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
                  coverage.toFixed(1).replace('.', ',') +
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
      </div>
      <div className="finance-fill-column finance-fill-controls">
        <BudgetEditor key={club.id} snapshot={snapshot} club={club} />
        <TicketPricing state={state} clubId={club.id} />
        <FinancialHistory snapshot={snapshot} club={club} />
      </div>
      <div className="finance-fill-column finance-fill-records">
        {[
          {
            name: 'Estádio',
            targets: ['pitch', 'surroundings', 'structure', 'food', 'shirts', 'hospitality'],
          },
          { name: 'CT', targets: ['fitness', 'medical', 'scouting', 'coaching', 'marketing'] },
        ].map((group) => (
          <section className="panel facility-cost-group finance-facility-card" key={group.name}>
            <header>
              <h3>{group.name}</h3>
              <strong>
                {currency(
                  costs
                    .filter((item) => group.targets.includes(item.target))
                    .reduce((sum, item) => sum + item.cost, 0),
                )}
                /mês
              </strong>
            </header>
            <p className="facility-return-note">
              {report.current.month} · Custos mensais · Sem upgrades
            </p>
            <div className="finance-facility-costs">
              {costs
                .filter((item) => group.targets.includes(item.target))
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
                              shirts: 'shirt',
                              hospitality: 'hospitality',
                              surroundings: 'entrance',
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
                    <span className="facility-return-values">
                      <span>
                        Custo <strong>{currency(item.cost)}</strong>
                      </span>
                      {attraction[item.target] !== undefined && (
                        <span title="Contribuição ao interesse da torcida, em pontos percentuais. Não representa aumento garantido de público.">
                          Atratividade{' '}
                          <b className="positive">
                            +{Number(attraction[item.target]!.toFixed(1)).toLocaleString('pt-BR')}{' '}
                            p.p.
                          </b>
                        </span>
                      )}
                    </span>
                  </a>
                ))}
            </div>
          </section>
        ))}
        <FinanceLedger snapshot={snapshot} club={club} />
      </div>
    </div>
  );
}
