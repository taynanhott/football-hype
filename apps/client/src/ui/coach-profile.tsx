import { Icon } from './icons';
import { Select, Option } from './select';
import type { CoachProfile } from './coach-profile-storage';
import { PersonAvatar } from './person-avatar';
import { useState } from 'react';

export function CoachAvatar({ profile }: { profile: CoachProfile }) {
  return <PersonAvatar profile={profile} className="coach-pixel-portrait" />;
}
export function CoachEditor({
  profile,
  onSave,
}: {
  profile: CoachProfile;

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
        <span>
          COMISSÃO TÉCNICA · <Icon name="ball" size={16} />
        </span>
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
          <Select value={draft.hair} onValueChange={(value) => update({ hair: value })}>
            <Option value="curto">Curto</Option>
            <Option value="cacheado">Cacheado</Option>
            <Option value="longo">Longo</Option>
            <Option value="raspado">Raspado</Option>
            <Option value="ondulado">Ondulado</Option>
            <Option value="topete">Topete</Option>
            <Option value="franja">Franja</Option>
            <Option value="moicano">Moicano</Option>
            <Option value="trancas">Tranças</Option>
            <Option value="coque">Coque</Option>
            <Option value="careca">Careca</Option>
          </Select>
        </label>
        <label>
          Barba
          <Select value={draft.beard} onValueChange={(value) => update({ beard: value })}>
            <Option value="nenhuma">Sem barba</Option>
            <Option value="curta">Curta</Option>
            <Option value="cheia">Cheia</Option>
            <Option value="bigode">Bigode</Option>
            <Option value="cavanhaque">Cavanhaque</Option>
            <Option value="longa">Longa</Option>
          </Select>
        </label>

        <label>
          Modelo da roupa
          <Select
            value={draft.outfitStyle}
            onValueChange={(value) => update({ outfitStyle: value })}
          >
            <Option value="agasalho">Agasalho</Option>
            <Option value="polo">Polo</Option>
            <Option value="camisa">Camisa listrada</Option>
            <Option value="camiseta">Camiseta</Option>
            <Option value="terno">Terno com gravata</Option>
          </Select>
        </label>
        <label>
          Óculos
          <Select value={draft.glasses} onValueChange={(value) => update({ glasses: value })}>
            <Option value="nenhum">Sem óculos</Option>
            <Option value="retangular">Retangular</Option>
            <Option value="redondo">Redondo</Option>
            <Option value="solar">Óculos de sol</Option>
          </Select>
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
    </form>
  );
}
