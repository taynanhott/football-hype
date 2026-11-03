import { useMemo } from 'react';
import { GAMEPLAY, formatMoneyFull, type WorldState } from '@football/shared';
import {
  TICKET_TIERS,
  matchDemand,
  projectTicketDemand,
  scheduledFixtures,
  stadiumCapacity,
} from '@football/domain';
import { useGameStore } from '../../store/game-store';
export function TicketPricing({ state, clubId }: { state: WorldState; clubId: string }) {
  const { send, busy, connected } = useGameStore();
  const next = useMemo(() => {
    const played = new Set(state.results.map((r) => r.fixtureId));
    return scheduledFixtures(state).find(
      (f) =>
        f.homeId === clubId &&
        !f.neutral &&
        !played.has(f.id) &&
        f.scheduledAt > state.lastProcessedAt,
    );
  }, [state, clubId]);
  const stadium = state.stadiums.byId[state.clubs.byId[clubId]?.stadiumId ?? ''];
  const capacity = stadium ? stadiumCapacity(stadium) : 0;
  const current = state.homeTicketPrices?.[clubId] ?? GAMEPLAY.baseTicketCents;
  const demand = next
    ? matchDemand(state, next)
    : { capacity, commerce: 0, selloutPriceCents: 5000000, minimumCrowdPriceCents: 20000000 };
  const tiers = TICKET_TIERS.map((t) => ({
    ...t,
    priceCents:
      Math.ceil(
        (t.priceCents *
          ('fairPriceCents' in demand ? demand.fairPriceCents : GAMEPLAY.baseTicketCents)) /
          GAMEPLAY.baseTicketCents /
          5000000,
      ) * 5000000,
  }));
  const selected = tiers.reduce(
    (best, t) =>
      Math.abs(t.priceCents - current) < Math.abs(best.priceCents - current) ? t : best,
    tiers[0]!,
  );
  const selectedForecast = projectTicketDemand(demand, selected.priceCents);
  const occupancy = Math.round(selectedForecast.occupancy * 100);
  return (
    <section className="panel ticket-pricing">
      <div className="section-header">
        <h2>Ingressos</h2>
        <span>{capacity.toLocaleString('pt-BR')} lugares</span>
      </div>
      <p>
        {stadium?.name} ·{' '}
        {next
          ? 'Próximo adversário: ' + state.clubs.byId[next.awayId]?.name
          : 'Projeção por jogo em casa'}
      </p>
      <div className="ticket-demand-summary">
        <div>
          <strong>♨ Procura estimada</strong>
          <b>{occupancy}% da capacidade</b>
        </div>
        <div
          className="ticket-demand-track"
          role="progressbar"
          aria-label="Procura estimada"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={occupancy}
        >
          <span style={{ width: occupancy + '%' }} />
        </div>
        <p>
          {occupancy >= 80
            ? 'Casa cheia: a torcida fortalece o time em casa.'
            : occupancy >= 50
              ? 'Boa procura: equilíbrio entre público e renda.'
              : 'Procura baixa: o preço afasta a torcida e reduz a força em casa.'}
        </p>
      </div>
      <div className="ticket-tier-options">
        {tiers.map((tier) => {
          const forecast = projectTicketDemand(demand, tier.priceCents);
          return (
            <button
              key={tier.label}
              type="button"
              className="ticket-tier-option"
              aria-pressed={selected.label === tier.label}
              disabled={!connected || busy}
              onClick={() => send({ type: 'home-ticket-price', priceCents: tier.priceCents })}
            >
              <span>
                <b>
                  {tier.label} · {formatMoneyFull(tier.priceCents)}
                </b>
                <small>{tier.description}</small>
              </span>
              <span>
                <strong>{forecast.attendance.toLocaleString('pt-BR')} torcedores</strong>
                <small>
                  {Math.round(forecast.occupancy * 100)}% · {formatMoneyFull(forecast.revenue)}/jogo
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
