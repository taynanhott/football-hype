import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { MoneyRange } from '../../ui/money-range';
import { useEffect, useRef, useState } from 'react';
import {
  UNLIMITED_MARKET_PRICE,
  defaultMarketFilters,
  type MarketFilterValues,
} from './market-filters';

type FilterProps = {
  value: MarketFilterValues;
  priceCeiling: number;
  countResults: (filters: MarketFilterValues) => number;
  onApply: (filters: MarketFilterValues) => void;
  onClose: () => void;
};
const money = (value: number) =>
  value === UNLIMITED_MARKET_PRICE
    ? 'Sem limite'
    : value === 0
      ? 'R$ 0'
      : new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(value);

export function MarketFiltersDialog(props: FilterProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<MarketFilterValues>(() => ({
    ...props.value,
    overall: [...props.value.overall],
    age: [...props.value.age],
    price: [...props.value.price],
  }));
  const resultCount = props.countResults(draft);
  useEffect(() => {
    return openModalPreservingScroll(dialog.current);
  }, []);
  const ranges = [
    {
      id: 'overall',
      label: 'Overall',
      values: draft.overall,
      set: (values: number[]) => setDraft((previous) => ({ ...previous, overall: values })),
      min: 1,
      max: 99,
      step: 1,
      format: (value: number) => String(value),
    },
    {
      id: 'age',
      label: 'Idade',
      values: draft.age,
      set: (values: number[]) => setDraft((previous) => ({ ...previous, age: values })),
      min: 16,
      max: 45,
      step: 1,
      format: (value: number) => value + ' anos',
    },
    {
      id: 'price',
      label: 'Valor de mercado',
      values: draft.price,
      set: (values: number[]) => setDraft((previous) => ({ ...previous, price: values })),
      min: 0,
      max: props.priceCeiling,
      step: 100000,
      format: money,
    },
  ];
  return (
    <dialog
      ref={dialog}
      className="market-filter-dialog"
      aria-labelledby="filter-title"
      onCancel={props.onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div className="market-filter-surface">
        <header className="market-filter-heading">
          <div>
            <h2 id="filter-title">Filtrar jogadores</h2>
            <p>Encontre a próxima peça do seu time.</p>
          </div>
          <button
            type="button"
            className="market-filter-close"
            aria-label="Fechar filtros"
            onClick={props.onClose}
          >
            ×
          </button>
        </header>
        <div className="market-filter-ranges">
          {ranges.map((range) => (
            <fieldset key={range.id} className="market-filter-range">
              <legend>{range.label}</legend>
              <div className="market-filter-boundaries">
                {[0, 1].map((index) => (
                  <label key={index}>
                    <span className="market-filter-value">
                      <span>{index === 0 ? 'Mínimo' : 'Máximo'}</span>
                      <output>{range.format(range.values[index]!)}</output>
                    </span>
                    <MoneyRange
                      className={range.id === 'price' ? 'money-range' : 'plain-filter-range'}
                      type="range"
                      aria-label={`${range.label} ${index === 0 ? 'mínimo' : 'máximo'}`}
                      min={range.min}
                      max={range.max}
                      step={range.step}
                      value={Math.min(range.max, range.values[index]!)}
                      onChange={(event) => {
                        const next = [...range.values];
                        const value = Number(event.target.value);
                        next[index] =
                          range.id === 'price' && index === 1 && value === range.max
                            ? UNLIMITED_MARKET_PRICE
                            : value;
                        if (next[0]! <= next[1]!) range.set(next);
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="market-filter-toggles">
          {[
            {
              label: 'Jogadores interessados no clube',
              checked: draft.interestedPlayers,
              set: (value: boolean) =>
                setDraft((previous) => ({ ...previous, interestedPlayers: value })),
            },
            {
              label: 'Clubes abertos a negociar',
              checked: draft.interestedClubs,
              set: (value: boolean) =>
                setDraft((previous) => ({ ...previous, interestedClubs: value })),
            },
          ].map((toggle) => (
            <label className="market-filter-toggle" key={toggle.label}>
              <span>{toggle.label}</span>
              <input
                type="checkbox"
                role="switch"
                checked={toggle.checked}
                onChange={(event) => toggle.set(event.target.checked)}
              />
            </label>
          ))}
        </div>
        <footer className="market-filter-actions">
          <button
            type="button"
            className="market-filter-reset"
            onClick={() => setDraft(defaultMarketFilters())}
          >
            Limpar filtros
          </button>
          <button
            type="button"
            className="market-filter-apply"
            onClick={() => props.onApply(draft)}
          >
            <span aria-live="polite">({resultCount.toLocaleString('pt-BR')})</span> Ver resultados
          </button>
        </footer>
      </div>
    </dialog>
  );
}
