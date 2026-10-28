import { GeneratedBadge } from './generated-badge';
import { useState } from 'react';
import { useGameStore } from '../store/game-store';

export function PixelBadge({
  name,
  url,
  size = 72,
}: {
  name: string;
  url?: string;
  size?: number;
}) {
  const storedUrl = useGameStore(
    (state) =>
      Object.values(state.snapshot?.state.clubs.byId ?? {}).find((club) => club.name === name)
        ?.crestUrl,
  );
  const source = url || storedUrl;
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <span className="official-club-badge" style={{ width: size, height: size }}>
      {source && failedUrl !== source ? (
        <img
          src={source}
          alt={'Escudo do ' + name}
          width={size}
          height={size}
          onError={() => setFailedUrl(source)}
        />
      ) : (
        <GeneratedBadge name={name} size={size} />
      )}
    </span>
  );
}
export function DivisionBadge({ division }: { division: string }) {
  return (
    <svg viewBox="0 0 32 32" width="34" height="34" shapeRendering="crispEdges" aria-hidden="true">
      <path
        d="M9 4H23V7H28V15H24V18H20V23H24V27H8V23H12V18H8V15H4V7H9ZM7 10V13H10V10ZM22 10V13H25V10Z"
        fill="#d4b766"
      />
      <path d="M12 6H20V16H12Z" fill="#f4df9a" />
      <text
        x="16"
        y="14"
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight="bold"
        fontSize="8"
        fill="#27473b"
      >
        {division}
      </text>
    </svg>
  );
}
