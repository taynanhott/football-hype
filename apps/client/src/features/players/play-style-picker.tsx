import type { PlayStyle } from '@football/shared';
import { STYLE_LABELS } from '@football/domain';
import { Icon } from '../../ui/icons';

const STYLES: { id: PlayStyle; icon: string; description: string }[] = [
  {
    id: 'balanced',
    icon: 'balance',
    description:
      'Meio-campistas e zagueiros fortes e descansados sustentam o equilíbrio. Leva vantagem contra contra-ataques.',
  },
  {
    id: 'gegenpress',
    icon: 'bolt',
    description:
      'Atacantes, pontas, volantes e meias com bom overall e condição física fortalecem a pressão. Leva vantagem contra posse de bola.',
  },
  {
    id: 'possession',
    icon: 'connections',
    description:
      'Meias, volantes e armadores com bom overall e condição física fortalecem o controle da bola. Leva vantagem contra equilíbrio e recuo total.',
  },
  {
    id: 'counter',
    icon: 'counterattack',
    description:
      'Centroavantes, pontas e armadores fortes e descansados favorecem as transições. Leva vantagem contra gegenpress e avanço pelas pontas.',
  },
  {
    id: 'wings',
    icon: 'width',
    description:
      'Pontas, meias abertos e laterais fortes e descansados ampliam a força pelos lados. Combina com 4-3-3, 3-4-3 e 4-2-4; leva vantagem contra recuo total.',
  },
  {
    id: 'low-block',
    icon: 'shield',
    description:
      'Zagueiros, volantes e goleiro com bom overall e condição física fortalecem a defesa. Combina com 5-3-2 e leva vantagem contra gegenpress.',
  },
];
export function PlayStylePicker({
  value,
  onChange,
}: {
  value: PlayStyle;
  onChange: (style: PlayStyle) => void;
}) {
  const selected = STYLES.find((style) => style.id === value)!;
  return (
    <section className="play-style-cards" aria-label="Estilo de jogo">
      <h3>Estilo de jogo</h3>
      <div className="play-style-grid" role="group" aria-label="Escolher estilo de jogo">
        {STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            className={`play-style-card play-style-${style.id} ${value === style.id ? 'is-selected' : ''}`}
            aria-pressed={value === style.id}
            aria-describedby={value === style.id ? 'play-style-description' : undefined}
            onClick={() => onChange(style.id)}
          >
            <Icon name={style.icon} size={25} />
            <span>{STYLE_LABELS[style.id]}</span>
          </button>
        ))}
      </div>
      <div className="play-style-description">
        {STYLES.map((style) => (
          <span className="play-style-description-measure" aria-hidden="true" key={style.id}>
            <strong>{STYLE_LABELS[style.id]}: </strong>
            {style.description}
          </span>
        ))}
        <p id="play-style-description" aria-live="polite">
          <strong>{STYLE_LABELS[value]}: </strong>
          {selected.description}
        </p>
      </div>
    </section>
  );
}
