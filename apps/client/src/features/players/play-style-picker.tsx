import { PLAY_STYLE_ICONS } from './play-style-icons';
import { playStyleSchema, type PlayStyle } from '@football/shared';
import { STYLE_LABELS, STYLE_ADVANTAGES } from '@football/domain';
import { Icon } from '../../ui/icons';
import { Select, Option } from '../../ui/select';

const DESCRIPTIONS: Record<PlayStyle, string> = {
  balanced: 'Meio-campistas e zagueiros fortes e descansados sustentam o equilíbrio.',
  gegenpress:
    'Atacantes e meio-campistas pressionam após perder a bola. Exige mais condição física.',
  possession: 'Meias, volantes e armadores fortes e descansados sustentam o controle da bola.',
  counter: 'Centroavantes, pontas e armadores fortes favorecem transições rápidas.',
  wings: 'Pontas e laterais ampliam a força pelos lados. Favorece formações abertas.',
  'low-block':
    'Zagueiros, volantes e goleiro reforçam a defesa. Favorece formações com cinco defensores.',
  'all-out-press':
    'Todo o time avança para sufocar a saída adversária. Aumenta a pressão e o desgaste físico, deixando espaço nas costas.',
};
export function PlayStyleOption({ style }: { style: PlayStyle }) {
  return (
    <span className={`play-style-option play-style-${style}`}>
      <Icon name={PLAY_STYLE_ICONS[style]} size={20} />
      <span>{STYLE_LABELS[style]}</span>
    </span>
  );
}
export function PlayStylePicker({
  value,
  onChange,
}: {
  value: PlayStyle;
  onChange: (style: PlayStyle) => void;
}) {
  const strong = STYLE_ADVANTAGES[value].map((s) => STYLE_LABELS[s]).join(' e ');
  const weak = playStyleSchema.options
    .filter((s) => STYLE_ADVANTAGES[s].includes(value))
    .map((s) => STYLE_LABELS[s])
    .join(' e ');
  return (
    <section className="play-style-cards" data-style={value} aria-label="Estilo de jogo">
      <Select
        value={value}
        onValueChange={(s) => onChange(playStyleSchema.parse(s))}
        className="play-style-select"
        aria-label="Estilo de jogo"
        menuMinWidth={240}
      >
        {playStyleSchema.options.map((style) => (
          <Option key={style} value={style}>
            <span className={`play-style-option play-style-${style}`}>
              <Icon name={PLAY_STYLE_ICONS[style]} size={20} />
              <span>{STYLE_LABELS[style]}</span>
            </span>
          </Option>
        ))}
      </Select>
      <div className="play-style-description">
        <p id="play-style-description" aria-live="polite">
          <strong>{STYLE_LABELS[value]}: </strong>
          {DESCRIPTIONS[value]} Vantagem contra {strong}. Fraco contra {weak}.
        </p>
      </div>
    </section>
  );
}
