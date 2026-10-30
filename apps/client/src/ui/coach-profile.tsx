import { COMPETITIONS } from '@football/shared';
import { CompetitionTrophy } from './competition-trophy';
import type { CoachProfile } from './coach-profile-storage';
import { PersonAvatar } from './person-avatar';
import { useState } from 'react';

export function CoachAvatar({ profile }: { profile: CoachProfile }) {
  return <PersonAvatar profile={profile} className="coach-pixel-portrait" />;
}
export function CoachEditor({
  profile,
  onSave,
  trophies = [],
}: {
  profile: CoachProfile;
  trophies?: readonly { competitionId: string }[];
  onSave: (profile: CoachProfile) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(profile);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const update = (patch: Partial<CoachProfile>) => {
    setDraft({ ...draft, ...patch });
    setSaved(false);
  };
  return (
    <form
      className="coach-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError('');
        try {
          await onSave({ ...draft, name: draft.name.trim() });
          setSaved(true);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Falha ao salvar técnico');
        } finally {
          setSaving(false);
        }
      }}
    >
      {error && <p role="alert">{error}</p>}
      <div className="coach-preview">
        <CoachAvatar profile={draft} />
        <strong>{draft.name || 'Treinador'}</strong>
        <span>COMISSÃO TÉCNICA · ⚽</span>
      </div>
      <div className="coach-controls">
        <label>
          Nome do treinador
          <input
            required
            maxLength={60}
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </label>
        <fieldset>
          <legend>Cor da pele</legend>
          <div className="coach-swatches">
            {[
              '#ffe3ce',
              '#f3d6b5',
              '#e7c29d',
              '#dfb18a',
              '#d49f7b',
              '#c58d65',
              '#b57c56',
              '#9b6346',
              '#855339',
              '#70452f',
              '#573724',
              '#432b22',
            ].map((skin) => (
              <button
                key={skin}
                type="button"
                aria-label={`Pele ${skin}`}
                aria-pressed={draft.skin === skin}
                style={{ background: skin }}
                onClick={() => update({ skin })}
              />
            ))}
          </div>
        </fieldset>
        <label>
          Cabelo
          <select value={draft.hair} onChange={(e) => update({ hair: e.target.value })}>
            <option value="curto">Curto</option>
            <option value="cacheado">Cacheado</option>
            <option value="longo">Longo</option>
            <option value="raspado">Raspado</option>
            <option value="ondulado">Ondulado</option>
            <option value="topete">Topete</option>
            <option value="franja">Franja</option>
            <option value="moicano">Moicano</option>
            <option value="trancas">Tranças</option>
            <option value="coque">Coque</option>
            <option value="careca">Careca</option>
          </select>
        </label>
        <label>
          Barba
          <select value={draft.beard} onChange={(e) => update({ beard: e.target.value })}>
            <option value="nenhuma">Sem barba</option>
            <option value="curta">Curta</option>
            <option value="cheia">Cheia</option>
            <option value="bigode">Bigode</option>
            <option value="cavanhaque">Cavanhaque</option>
            <option value="longa">Longa</option>
          </select>
        </label>

        <label>
          Modelo da roupa
          <select
            value={draft.outfitStyle}
            onChange={(e) => update({ outfitStyle: e.target.value })}
          >
            <option value="agasalho">Agasalho</option>
            <option value="polo">Polo</option>
            <option value="camisa">Camisa listrada</option>
            <option value="camiseta">Camiseta</option>
            <option value="terno">Terno com gravata</option>
          </select>
        </label>
        <label>
          Óculos
          <select value={draft.glasses} onChange={(e) => update({ glasses: e.target.value })}>
            <option value="nenhum">Sem óculos</option>
            <option value="retangular">Retangular</option>
            <option value="redondo">Redondo</option>
            <option value="solar">Óculos de sol</option>
          </select>
        </label>
        <fieldset className="coach-colors">
          <legend>Cores e detalhes</legend>
          <div className="coach-colors-grid">
            <label className="coach-color-field">
              <input
                type="color"
                aria-label="Cor: Cabelo"
                value={draft.hairColor}
                onChange={(e) => update({ hairColor: e.target.value })}
              />
              <span className="coach-color-caption">
                <span>Cabelo</span>
                <small>{draft.hairColor.toUpperCase()}</small>
              </span>
            </label>
            <label className="coach-color-field">
              <input
                type="color"
                aria-label="Cor: Barba"
                value={draft.beardColor}
                onChange={(e) => update({ beardColor: e.target.value })}
              />
              <span className="coach-color-caption">
                <span>Barba</span>
                <small>{draft.beardColor.toUpperCase()}</small>
              </span>
            </label>
            <label className="coach-color-field">
              <input
                type="color"
                aria-label="Cor: Olhos"
                value={draft.eyeColor}
                onChange={(e) => update({ eyeColor: e.target.value })}
              />
              <span className="coach-color-caption">
                <span>Olhos</span>
                <small>{draft.eyeColor.toUpperCase()}</small>
              </span>
            </label>
            <label className="coach-color-field">
              <input
                type="color"
                aria-label="Cor: Roupa"
                value={draft.outfit}
                onChange={(e) => update({ outfit: e.target.value })}
              />
              <span className="coach-color-caption">
                <span>Roupa</span>
                <small>{draft.outfit.toUpperCase()}</small>
              </span>
            </label>
            <label className="coach-color-field">
              <input
                type="color"
                aria-label="Cor: Detalhes da roupa"
                value={draft.secondary}
                onChange={(e) => update({ secondary: e.target.value })}
              />
              <span className="coach-color-caption">
                <span>Detalhes</span>
                <small>{draft.secondary.toUpperCase()}</small>
              </span>
            </label>
            <label className="coach-color-field">
              <input
                type="color"
                aria-label="Cor: Armação"
                value={draft.glassesColor}
                onChange={(e) => update({ glassesColor: e.target.value })}
              />
              <span className="coach-color-caption">
                <span>Armação</span>
                <small>{draft.glassesColor.toUpperCase()}</small>
              </span>
            </label>
          </div>
        </fieldset>
        <button className="coach-save" type="submit" disabled={saving}>
          Salvar treinador
        </button>
        <span role="status">{saved ? '✓ Perfil salvo na carreira' : ''}</span>
      </div>
      <section className="coach-trophy-shelf" aria-label="Troféus do treinador">
        <h2>Conquistas do treinador</h2>
        <div className="trophy-gallery trophy-gallery-compact">
          {COMPETITIONS.filter((rule) => rule.id !== 'pre-libertadores').map((rule) => {
            const count = trophies.filter((trophy) => trophy.competitionId === rule.id).length;
            return (
              <article className="panel trophy-card" data-earned={count > 0} key={rule.id}>
                <CompetitionTrophy competitionId={rule.id} name={rule.name} />
                <h2>
                  <b>{count}x</b> {rule.name}
                </h2>
              </article>
            );
          })}
        </div>
      </section>
    </form>
  );
}
