import { shortMoney } from '../../ui/format';
import { openModalPreservingScroll } from '../../ui/modal-scroll';
import { Select, Option } from '../../ui/select';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  UNLIMITED_MARKET_PRICE,
  defaultMarketFilters,
  type MarketFilterValues,
} from './market-filters';

type FilterProps = {
  value: MarketFilterValues;
  priceCeiling: number;
  salaryCeiling?: number;
  countResults: (filters: MarketFilterValues) => number;
  onApply: (filters: MarketFilterValues) => void;
  onClose: () => void;
};
export function MarketFiltersDialog(props: FilterProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<MarketFilterValues>(() => ({
    ...defaultMarketFilters(),
    ...props.value,
  }));
  useEffect(() => openModalPreservingScroll(dialog.current), []);
  const count = props.countResults(draft);
  const money = (value: number) =>
    value === UNLIMITED_MARKET_PRICE ? 'Sem limite' : shortMoney(value * 100);
  const ranges = [
    {
      id: 'overall',
      label: 'Overall',
      values: draft.overall,
      min: 1,
      max: 99,
      step: 1,
      format: (v: number) => String(v),
    },
    {
      id: 'age',
      label: 'Idade',
      values: draft.age,
      min: 16,
      max: 45,
      step: 1,
      format: (v: number) => v + ' anos',
    },
    {
      id: 'price',
      label: 'Valor de mercado',
      values: draft.price,
      min: 0,
      max: props.priceCeiling,
      step: 50000,
      format: money,
    },
    {
      id: 'salary',
      label: 'Salário por dia',
      values: draft.salary ?? [0, UNLIMITED_MARKET_PRICE],
      min: 0,
      max: props.salaryCeiling ?? 10000,
      step: 1,
      format: money,
    },
  ] as const;
  return (
    <dialog
      ref={dialog}
      className="market-filter-dialog market-filter-redesign"
      aria-labelledby="filter-title"
      onCancel={props.onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div className="market-filter-surface">
        <header className="market-filter-heading">
          <h2 id="filter-title">⚽ Filtros</h2>
        </header>
        <div className="market-filter-selects">
          <label className="filter-situation">
            Situação
            <Select
              value={draft.situation ?? 'all'}
              onValueChange={(value) => setDraft((previous) => ({ ...previous, situation: value }))}
              aria-label="Situação"
            >
              <Option value="all">Todos</Option>
              <Option value="sale">À venda</Option>
              <Option value="loan">Disponível para empréstimo</Option>
              <Option value="free">Sem clube</Option>
              <Option value="expiring">Contrato acabando</Option>
            </Select>
          </label>
          <label>
            Posição
            <Select
              value={draft.position ?? 'ALL'}
              onValueChange={(value) => setDraft((previous) => ({ ...previous, position: value }))}
              aria-label="Posição"
            >
              <Option value="ALL">Todas</Option>
              {[
                ['GK', 'GOL'],
                ['CB', 'ZAG'],
                ['RB', 'LD'],
                ['LB', 'LE'],
                ['RWB', 'ALA D'],
                ['LWB', 'ALA E'],
                ['DM', 'VOL'],
                ['CM', 'MC'],
                ['AM', 'MEI'],
                ['LM', 'ME'],
                ['RM', 'MD'],
                ['LW', 'PE'],
                ['RW', 'PD'],
                ['SS', 'SA'],
                ['ST', 'CA'],
              ].map(([value, label]) => (
                <Option key={value} value={value!}>
                  {label}
                </Option>
              ))}
            </Select>
          </label>
          <label>
            Continente
            <Select
              value={draft.continent ?? 'all'}
              onValueChange={(value) => setDraft((previous) => ({ ...previous, continent: value }))}
              aria-label="Continente"
            >
              {[
                ['all', 'Todos'],
                ['south', 'América do Sul'],
                ['north', 'América do Norte e Central'],
                ['europe', 'Europa'],
                ['africa', 'África'],
                ['asia', 'Ásia'],
                ['oceania', 'Oceania'],
              ].map(([value, label]) => (
                <Option key={value} value={value!}>
                  {label}
                </Option>
              ))}
            </Select>
          </label>
        </div>
        <div className="market-filter-dual-ranges">
          {ranges.map((range) => {
            const low = Math.min(range.max, range.values[0]!);
            const high = Math.min(range.max, range.values[1]!);
            const style = {
              '--range-start': ((low - range.min) / (range.max - range.min)) * 100 + '%',
              '--range-end': ((high - range.min) / (range.max - range.min)) * 100 + '%',
            } as CSSProperties;
            return (
              <fieldset key={range.id} className="market-dual-range">
                <legend>{range.label}</legend>
                <output>
                  {range.format(range.values[0]!)} – {range.format(range.values[1]!)}
                </output>
                <div className="market-dual-track" style={style}>
                  {[0, 1].map((index) => (
                    <input
                      key={index}
                      type="range"
                      min={range.min}
                      max={range.max}
                      step={range.step}
                      value={index === 0 ? low : high}
                      aria-label={`${range.label} ${index === 0 ? 'mínimo' : 'máximo'}`}
                      onChange={(event) => {
                        const next = [...range.values];
                        let value = Number(event.target.value);
                        if (index === 0) value = Math.min(value, high);
                        else value = Math.max(value, low);
                        next[index] =
                          (range.id === 'price' || range.id === 'salary') &&
                          index === 1 &&
                          value === range.max
                            ? UNLIMITED_MARKET_PRICE
                            : value;
                        setDraft((previous) => ({ ...previous, [range.id]: next }));
                      }}
                    />
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
        <footer className="market-filter-actions">
          <button
            type="button"
            className="market-filter-reset"
            onClick={() => setDraft(defaultMarketFilters())}
          >
            Limpar
          </button>
          <button
            type="button"
            className="market-filter-apply"
            onClick={() => props.onApply(draft)}
          >
            Ver {count.toLocaleString('pt-BR')} jogadores
          </button>
        </footer>
        <button type="button" className="market-filter-back" onClick={props.onClose}>
          ← Voltar
        </button>
      </div>
    </dialog>
  );
}
