import { MoneyRange } from '../../ui/money-range';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GAMEPLAY, MONEY_STEPS, roundMoney, type Fixture, type WorldState } from '@football/shared';
import { matchDemand, projectTicketDemand, scheduledFixtures } from '@football/domain';
import { useGameStore } from '../../store/game-store';
import { currency, dateTime, ticketPrice } from '../../ui/format';

export function TicketPricing({ state, clubId }: { state: WorldState; clubId: string }) {
  const fixtures = useMemo(() => {
    const completed = new Set(state.results.map((result) => result.fixtureId));
    const stadiumId = state.clubs.byId[clubId]?.stadiumId;
    return scheduledFixtures(state).filter(
      (fixture) =>
        fixture.homeId === clubId &&
        !fixture.neutral &&
        (!fixture.stadiumId || fixture.stadiumId === stadiumId) &&
        !completed.has(fixture.id) &&
        fixture.scheduledAt > state.lastProcessedAt,
    );
  }, [state, clubId]);
  const saved = roundMoney(
    state.homeTicketPrices?.[clubId] ?? GAMEPLAY.baseTicketCents,
    MONEY_STEPS.ticket,
  );
  return (
    <section className="panel ticket-pricing">
      <div className="section-header">
        <div>
          <span className="eyebrow">TORCIDA E BILHETERIA</span>
          <h2>Ingressos dos jogos em casa</h2>
        </div>
      </div>
      <p>
        Um único preço para todos os próximos jogos em casa. Jogos decisivos aumentam a disposição
        de pagar; má fase e preços altos reduzem a procura.
      </p>
      <HomeTicketSlider key={clubId} state={state} fixtures={fixtures} saved={saved} />
    </section>
  );
}

function HomeTicketSlider({
  state,
  fixtures,
  saved,
}: {
  state: WorldState;
  fixtures: Fixture[];
  saved: number;
}) {
  const [price, setPrice] = useState(saved);
  const [requestedPrice, setRequestedPrice] = useState<number | null>(null);
  const draft = useRef(saved);
  const dirty = useRef(false);
  const dragging = useRef(false);
  const { send, busy, connected, error, clearError } = useGameStore();
  const submitted = useRef<number | null>(null);
  const ranges = useMemo(
    () => fixtures.map((fixture) => matchDemand(state, fixture)),
    [state, fixtures],
  );
  const minPrice = ranges.length
    ? Math.min(...ranges.map((item) => item.selloutPriceCents))
    : MONEY_STEPS.ticket;
  const maxPrice = ranges.length
    ? Math.max(...ranges.map((item) => item.minimumCrowdPriceCents))
    : 50000;
  // Existing prices can remain outside a newly recalculated range until the user adjusts them.
  const sliderValue = Math.max(minPrice, Math.min(maxPrice, price));
  const finishAdjustment = () => {
    dragging.current = false;
    setRequestedPrice(draft.current);
  };
  useEffect(() => {
    if (submitted.current === saved) {
      submitted.current = null;
      setRequestedPrice((requested) => (requested === saved ? null : requested));
    }
    if (
      !dragging.current &&
      (!dirty.current || (draft.current === saved && submitted.current === null))
    ) {
      draft.current = saved;
      dirty.current = false;
      setPrice(saved);
    }
  }, [saved]);
  useEffect(() => {
    if (
      requestedPrice === null ||
      dragging.current ||
      requestedPrice === saved ||
      busy ||
      !connected ||
      error ||
      submitted.current === requestedPrice
    )
      return;
    submitted.current = requestedPrice;
    send({ type: 'home-ticket-price', priceCents: requestedPrice });
  }, [requestedPrice, saved, busy, connected, error, send]);
  const next = fixtures[0];

  const forecasts = ranges.map((range) => ({ ...range, ...projectTicketDemand(range, price) }));
  const forecast = forecasts[0];
  const totalAttendance = forecasts.reduce((sum, item) => sum + item.attendance, 0);
  const totalCapacity = forecasts.reduce((sum, item) => sum + item.capacity, 0);

  return (
    <div className="home-ticket-slider">
      <label htmlFor="home-ticket-price">
        Preço do ingresso <strong>{ticketPrice(price)}</strong>
      </label>
      <MoneyRange
        id="home-ticket-price"
        type="range"
        min={minPrice}
        max={maxPrice}
        step={MONEY_STEPS.ticket}
        value={sliderValue}
        disabled={!connected}
        onPointerDown={() => {
          dragging.current = true;
          setRequestedPrice(null);
        }}
        onKeyDown={(event) => {
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
            ].includes(event.key)
          ) {
            dragging.current = true;
            setRequestedPrice(null);
          }
        }}
        onPointerUp={finishAdjustment}
        onPointerCancel={finishAdjustment}
        onKeyUp={(event) => {
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
            ].includes(event.key)
          )
            finishAdjustment();
        }}
        onBlur={finishAdjustment}
        aria-valuetext={`${ticketPrice(price)}, ${totalCapacity ? Math.round((totalAttendance / totalCapacity) * 100) : 0}% de ocupação prevista`}
        onChange={(event) => {
          if (error) {
            clearError();
            submitted.current = null;
            setRequestedPrice(null);
          }
          const value = roundMoney(Number(event.target.value), MONEY_STEPS.ticket);
          draft.current = value;
          dirty.current = true;
          setPrice(value);
        }}
      />
      <div className="ticket-slider-limits">
        <span>Menor preço</span>
        <span>Maior preço</span>
      </div>
      {(error || !connected) && (
        <p className="ticket-price-status" role="alert">
          {error
            ? `Não foi possível salvar: ${error}`
            : 'Sem conexão. Reconecte para ajustar o preço.'}
        </p>
      )}
      {forecast && next ? (
        <>
          <p>
            Próximo jogo em casa: <b>{state.clubs.byId[next.awayId]?.name ?? 'Adversário'}</b> ·{' '}
            {dateTime(next.scheduledAt)}.
          </p>
          <div className="ticket-forecast">
            <div>
              <span>Público esperado no próximo jogo</span>
              <strong>{forecast.attendance.toLocaleString('pt-BR')}</strong>
              <small>{Math.round(forecast.occupancy * 100)}% da capacidade</small>
            </div>
            <div>
              <span>Bilheteria do próximo jogo</span>
              <strong>{currency(forecast.ticketRevenue)}</strong>
              <small>Antes de consumo e despesas</small>
            </div>
            <div>
              <span>Ocupação média dos jogos agendados</span>
              <strong>
                {totalCapacity ? Math.round((totalAttendance / totalCapacity) * 100) : 0}%
              </strong>
              <small>{fixtures.length} jogos em casa com confronto definido</small>
            </div>
          </div>
          <p>
            {forecast.importanceLabel} · Aproveitamento recente: {Math.round(forecast.form * 100)}%.
          </p>
        </>
      ) : (
        <p>
          Nenhum jogo futuro em casa com confronto definido. O preço será aplicado aos próximos
          jogos assim que forem agendados.
        </p>
      )}
      <p>
        O preço é salvo automaticamente após o ajuste e também vale para os jogos em casa que ainda
        serão definidos. Ajustes em passos de R$ 25. As projeções mudam conforme a fase do time e a
        importância de cada partida.
      </p>
    </div>
  );
}
