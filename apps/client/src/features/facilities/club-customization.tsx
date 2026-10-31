import { PixelBadge } from '../../ui/pixel-badge';
import { useState } from 'react';
import { clubKit } from '@football/shared';
import type { ViewProps } from '../../ui/view-props';
import { Select, Option } from '../../ui/select';
import { useGameStore } from '../../store/game-store';
const COLORS = [
  '#ffffff',
  '#141414',
  '#ce1238',
  '#244e9b',
  '#17834d',
  '#f2c94c',
  '#ee782b',
  '#713e91',
  '#315d55',
  '#e5dfcf',
];
function ClubColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="club-color-field">
      <span>{label}</span>
      <div className="coach-swatches">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={label + ' ' + color}
            aria-pressed={value.toLowerCase() === color}
            style={{ background: color }}
            onClick={() => onChange(color)}
          />
        ))}
        <label
          className="club-custom-color"
          style={{ background: value }}
          title="Cor personalizada"
        >
          <input
            aria-label={label + ' personalizada'}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <span>+</span>
        </label>
      </div>
    </div>
  );
}
export function ClubCustomization({ club, stadium, center }: ViewProps) {
  const send = useGameStore((state) => state.send);
  const busy = useGameStore((state) => state.busy);
  const [stadiumColor, setStadiumColor] = useState(stadium.color ?? '#315d55');
  const [centerColor, setCenterColor] = useState(center.color ?? '#e5dfcf');
  const identity = clubKit(club);
  const [primary, setPrimary] = useState(identity.primary);
  const [secondary, setSecondary] = useState(identity.secondary);
  const [pattern, setPattern] = useState<'solid' | 'stripes' | 'hoops' | 'sash'>(identity.pattern);

  return (
    <section className="panel customization">
      <div className="club-kit-stage">
        <svg
          viewBox="0 0 64 72"
          shapeRendering="crispEdges"
          aria-label="Prévia do uniforme em pixel art"
        >
          <defs>
            <clipPath id="club-shirt">
              <path d="M16 8h10v4h12V8h10v4h4v4h4v4h4v12H48v32H16V32H4V20h4v-4h4v-4h4z" />
            </clipPath>
          </defs>
          <g clipPath="url(#club-shirt)">
            <rect width="64" height="72" fill={primary} />
            {Array.from({ length: 8 }, (_, i) =>
              pattern === 'stripes' ? (
                <rect key={i} x={i * 8} y="0" width="4" height="72" fill={secondary} />
              ) : pattern === 'hoops' ? (
                <rect key={i} x="0" y={i * 10} width="64" height="5" fill={secondary} />
              ) : null,
            )}
            {pattern === 'sash' && <path d="M0 52L64 0v12L0 64z" fill={secondary} />}
            <path
              d="M16 8h10v4h12V8h10v4H38v4H26v-4H16zM4 28h12v4H4zM48 28h12v4H48z"
              fill={secondary}
            />
            <path d="M16 32h4v32h-4zM44 32h4v32h-4zM16 60h32v4H16z" fill="#000" opacity=".2" />
            <foreignObject x="38" y="21" width="9" height="11">
              <PixelBadge
                name={club.name}
                {...(club.crestUrl ? { url: club.crestUrl } : {})}
                size={9}
              />
            </foreignObject>
            <path d="M23 38h18v3H23z" fill="#fff" opacity=".7" />
          </g>
        </svg>
        <span>UNIFORME DO CLUBE</span>
      </div>
      <div className="club-kit-controls">
        <ClubColor label="Cor do estádio" value={stadiumColor} onChange={setStadiumColor} />
        <ClubColor label="Cor do CT" value={centerColor} onChange={setCenterColor} />
        <ClubColor label="Uniforme: cor principal" value={primary} onChange={setPrimary} />
        <ClubColor label="Uniforme: cor secundária" value={secondary} onChange={setSecondary} />
        <label>
          Padrão
          <Select
            aria-label="Padrão"
            value={pattern}
            onValueChange={(value) => setPattern(value as typeof pattern)}
          >
            <Option value="solid">Liso</Option>
            <Option value="stripes">Listras verticais</Option>
            <Option value="hoops">Listras horizontais</Option>
            <Option value="sash">Faixa diagonal</Option>
          </Select>
        </label>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            send({
              type: 'customize',

              stadiumColor,
              centerColor,
              primary,
              secondary,
              pattern,
            })
          }
        >
          Salvar identidade
        </button>
      </div>
    </section>
  );
}
