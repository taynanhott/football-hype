import { GeneratedBadge } from './generated-badge';
import { clubCrest, clubCrestSchema } from '@football/shared';
import { useGameStore } from '../store/game-store';
import catalog from '../data/club-catalog.json';

const catalogClubs = new Map(
  catalog.clubs.map((club) => [
    club.name,
    {
      name: club.name,
      abbreviation: club.abbreviation,
      crest: clubCrestSchema.parse(club.crest),
    },
  ]),
);

export function PixelBadge({ name, size = 72 }: { name: string; url?: string; size?: number }) {
  const storedClub = useGameStore((state) =>
    Object.values(state.snapshot?.state.clubs.byId ?? {}).find((club) => club.name === name),
  );
  const club = storedClub ?? catalogClubs.get(name);
  const crest = clubCrest(club ?? { name, abbreviation: '' });
  return (
    <span className="official-club-badge" style={{ width: size, height: size }}>
      <GeneratedBadge name={name} size={size} crest={crest} />
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
