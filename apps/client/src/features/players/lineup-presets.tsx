import { useEffect, useRef, useState } from 'react';
import type { Lineup, WorldState } from '@football/shared';
import { STYLE_LABELS } from '@football/domain';
import { useGameStore } from '../../store/game-store';

export function LineupPresets({
  presets,
  current,
  onLoad,
}: {
  presets: WorldState['lineupPresets'][string];
  current: Lineup;
  onLoad: (lineup: Lineup) => void;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const closeMenus = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      root.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
        if (event instanceof KeyboardEvent || !menu.contains(event.target as Node))
          menu.open = false;
      });
    };
    document.addEventListener('pointerdown', closeMenus);
    document.addEventListener('keydown', closeMenus);
    return () => {
      document.removeEventListener('pointerdown', closeMenus);
      document.removeEventListener('keydown', closeMenus);
    };
  }, []);
  const send = useGameStore((state) => state.send);
  const busy = useGameStore((state) => state.busy);
  const connected = useGameStore((state) => state.connected);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const lineupKey = (plan: Lineup) =>
    JSON.stringify({
      formation: plan.formation,
      style: plan.style ?? 'balanced',
      starters: plan.starters,
      bench: plan.bench ?? [],
    });
  const loadedId = presets.find((preset) => lineupKey(preset.lineup) === lineupKey(current))?.id;
  const unavailable = busy || !connected;
  function edit(id: string, initial = '') {
    setEditing(id);
    setName(initial);
  }
  return (
    <section ref={root} className="lineup-presets" aria-label="Presets de escalação">
      <div className="lineup-presets-heading">
        <div>
          <h2>
            <span aria-hidden="true">▤</span> ESCALAÇÕES SALVAS
          </h2>
        </div>
        <small>{presets.length}/3</small>
      </div>
      {editing !== null && (
        <form
          className="preset-name-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (unavailable || !name.trim()) return;
            if (editing === 'new')
              send({
                type: 'lineup-preset',
                action: 'create',
                id: crypto.randomUUID(),
                name: name.trim(),
                lineup: structuredClone(current),
              });
            else send({ type: 'lineup-preset', action: 'rename', id: editing, name: name.trim() });
            setEditing(null);
          }}
        >
          <label htmlFor="preset-name">
            {editing === 'new' ? 'Nome do novo preset' : 'Editar nome do preset'}
          </label>
          <input
            id="preset-name"
            value={name}
            maxLength={40}
            autoFocus
            placeholder="Ex.: Time principal"
            onChange={(event) => setName(event.target.value)}
          />
          <button className="primary" disabled={unavailable || !name.trim()}>
            {editing === 'new' ? 'Salvar preset atual' : 'Salvar nome'}
          </button>
          <button type="button" className="secondary" onClick={() => setEditing(null)}>
            Cancelar
          </button>
        </form>
      )}
      <div className="lineup-presets-grid">
        {presets.map((preset) => (
          <article
            className={`lineup-preset ${loadedId === preset.id ? 'is-loaded' : ''}`}
            key={preset.id}
          >
            <button
              type="button"
              className="preset-load"
              disabled={unavailable}
              onClick={() => {
                onLoad(structuredClone(preset.lineup));
              }}
              aria-label={`Carregar preset ${preset.name}`}
            >
              <span>
                <strong>{preset.name}</strong>
                <small>
                  {preset.lineup.formation} · {STYLE_LABELS[preset.lineup.style ?? 'balanced']}
                </small>
              </span>
            </button>
            <details className="preset-menu">
              <summary aria-label={`Ações do preset ${preset.name}`}>···</summary>
              <div
                className="preset-actions"
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('button')) {
                    const menu = event.currentTarget.closest('details');
                    if (menu) menu.open = false;
                  }
                }}
              >
                <button
                  type="button"
                  disabled={unavailable}
                  onClick={() => edit(preset.id, preset.name)}
                >
                  Editar nome
                </button>
                <button
                  type="button"
                  disabled={unavailable || current.starters.length !== 11}
                  onClick={() =>
                    send({
                      type: 'lineup-preset',
                      action: 'update',
                      id: preset.id,
                      lineup: current,
                    })
                  }
                >
                  Atualizar escalação
                </button>
                <button
                  type="button"
                  className="preset-delete"
                  disabled={unavailable}
                  onClick={() => {
                    send({ type: 'lineup-preset', action: 'delete', id: preset.id });
                    if (editing === preset.id) setEditing(null);
                  }}
                >
                  Excluir
                </button>
              </div>
            </details>
          </article>
        ))}
        {presets.length < 3 && (
          <button
            type="button"
            className="preset-create"
            disabled={unavailable || current.starters.length !== 11}
            onClick={() => edit('new')}
          >
            + Salvar atual
          </button>
        )}
      </div>
    </section>
  );
}
