import { useState } from 'react';
import { clubKit } from '@football/shared';
import type { ViewProps } from '../../ui/view-props';
import { Select, Option } from '../../ui/select';
import { useGameStore } from '../../store/game-store';
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
      <h2>Identidade do clube</h2>
      <label>
        Cor do estádio
        <input
          type="color"
          value={stadiumColor}
          onChange={(e) => setStadiumColor(e.target.value)}
        />
      </label>
      <label>
        Cor do CT
        <input type="color" value={centerColor} onChange={(e) => setCenterColor(e.target.value)} />
      </label>
      <label>
        Uniforme: cor principal
        <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
      </label>
      <label>
        Uniforme: cor secundária
        <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
      </label>
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
      <div
        className="kit-preview"
        aria-label="Prévia do uniforme"
        style={{
          background:
            pattern === 'solid'
              ? primary
              : pattern === 'sash'
                ? `linear-gradient(135deg, ${primary} 40%, ${secondary} 40%, ${secondary} 60%, ${primary} 60%)`
                : `repeating-linear-gradient(${pattern === 'stripes' ? 90 : 0}deg, ${primary} 0 12px, ${secondary} 12px 24px)`,
        }}
      />
      <button
        className="primary"
        disabled={busy}
        onClick={() =>
          send({ type: 'customize', stadiumColor, centerColor, primary, secondary, pattern })
        }
      >
        Salvar identidade
      </button>
    </section>
  );
}
