import { useId } from 'react';
import { clubKit } from '@football/shared';

/** Stable pixel heraldry for clubs without an official crest image. */
export function GeneratedBadge({ name, size }: { name: string; size: number }) {
  const clip = useId();
  const kit = clubKit({ name });
  const seed = Array.from(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).reduce(
    (value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0,
    7,
  );
  const shapes = [
    'M12 8H52V12H56V36H52V44H48V48H44V52H38V56H26V52H20V48H16V44H12V36H8V12H12Z',
    'M20 6H44V10H52V18H56V42H52V48H44V54H36V58H28V54H20V48H12V42H8V18H12V10H20Z',
    'M8 10H56V36H52V44H48V48H40V52H36V58H28V52H24V48H16V44H12V36H8Z',
  ];
  const shape = shapes[seed % shapes.length]!;
  const initials = (name.trim().split(/\s+/)[0] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 3)
    .toUpperCase();
  const gold = '#e7c97e';
  const shadow = '#172620';
  return (
    <svg
      className="generated-pixel-badge"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={'Escudo gerado em pixel art do ' + name}
      shapeRendering="crispEdges"
    >
      <defs>
        <clipPath id={clip}>
          <path d={shape} />
        </clipPath>
      </defs>
      <path d={shape} fill={shadow} transform="translate(0 2)" />
      <path d={shape} fill={gold} />
      <g clipPath={`url(#${clip})`}>
        <path d={shape} fill={kit.primary} transform="translate(4 4) scale(.875)" />
        {Array.from({ length: 6 }, (_, i) =>
          seed % 3 === 0 ? (
            <rect
              key={i}
              x={12 + i * 8}
              y="13"
              width="4"
              height="39"
              fill={kit.secondary}
              opacity=".85"
            />
          ) : seed % 3 === 1 ? (
            <rect
              key={i}
              x="10"
              y={15 + i * 7}
              width="44"
              height="3"
              fill={kit.secondary}
              opacity=".8"
            />
          ) : (
            <path
              key={i}
              d={`M${-20 + i * 16} 55l44-44h7L${-13 + i * 16} 55z`}
              fill={kit.secondary}
              opacity=".8"
            />
          ),
        )}
        <path
          d="M13 12H51V15H13ZM13 15H16V39H13ZM16 39H19V45H16ZM19 45H24V48H19"
          fill="#ffffff"
          opacity=".3"
        />
        <path
          d="M48 16H51V36H48ZM44 40H48V44H44ZM38 48H44V51H38ZM29 53H35V56H29"
          fill="#000000"
          opacity=".35"
        />
        <path d="M16 21H48V23H51V37H48V40H16V37H13V23H16Z" fill={shadow} />
        <path d="M16 23H48V25H50V36H47V38H17V36H14V25H16Z" fill={kit.primary} />
        <text
          x="32"
          y="34"
          textAnchor="middle"
          fontFamily="monospace"
          fontWeight="900"
          fontSize={initials.length > 2 ? 11 : 13}
          letterSpacing="1"
          fill={kit.secondary}
        >
          {initials}
        </text>
        <path d="M29 42H35V44H38V50H35V52H29V50H26V44H29Z" fill="#fff6d6" />
        <path d="M30 45H34V49H30ZM26 47H28V49H26ZM35 49H37V51H35" fill={shadow} />
      </g>
      <path d="M30 1H34V3H38V5H34V8H30V5H26V3H30Z" fill={gold} />
      {seed % 2 === 0 && (
        <path
          d="M17 3H20V5H23V7H20V9H17V7H14V5H17ZM44 3H47V5H50V7H47V9H44V7H41V5H44Z"
          fill={gold}
        />
      )}
      <path
        d="M3 23H6V30H3ZM1 31H4V38H1ZM4 40H7V46H4ZM8 48H12V52H8ZM58 23H61V30H58ZM60 31H63V38H60ZM57 40H60V46H57ZM52 48H56V52H52Z"
        fill={gold}
      />
      <path d="M14 53H24V55H40V53H50V59H44V61H20V59H14Z" fill={shadow} />
      <path d="M16 54H24V56H40V54H48V58H42V60H22V58H16Z" fill={gold} />
      <path d="M25 57H39V58H25Z" fill="#8c673a" />
    </svg>
  );
}
