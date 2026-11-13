import { useId } from 'react';
import { clubCrest, type ClubCrest } from '@football/shared';

import { badgeShapes as shapes, badgeSymbols as symbols } from './badge-art';

function ink(background: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16));
  return rgb[0]! * 0.299 + rgb[1]! * 0.587 + rgb[2]! * 0.114 > 150 ? '#15191d' : '#fff8e8';
}

export function GeneratedBadge({
  name,
  size,
  crest,
}: {
  name: string;
  size: number;
  crest?: ClubCrest;
}) {
  const clip = useId();
  const identity = crest ?? clubCrest({ name, abbreviation: '' });
  const { shape, pattern, symbol, primary, secondary, accent, initials } = identity;
  const silhouette = shapes[shape];
  const foreground = ink(primary);
  return (
    <svg
      className="generated-pixel-badge"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={'Escudo em pixel art do ' + name}
      shapeRendering="crispEdges"
    >
      <defs>
        <clipPath id={clip}>
          <path d={silhouette} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <path d={silhouette} fill={primary} />
        {pattern === 'stripes' &&
          [12, 26, 40, 54].map((x) => (
            <rect key={x} x={x} y="3" width="7" height="59" fill={secondary} />
          ))}
        {pattern === 'hoops' &&
          [13, 27, 41, 55].map((y) => (
            <rect key={y} x="3" y={y} width="58" height="7" fill={secondary} />
          ))}
        {pattern === 'sash' && (
          <path
            d="M4 52H10V46H16V40H22V34H28V28H34V22H40V16H46V10H52V4H64V16H58V22H52V28H46V34H40V40H34V46H28V52H22V58H16V64H4Z"
            fill={secondary}
          />
        )}
        {pattern === 'split' && <path d="M32 2H62V62H32Z" fill={secondary} />}
        {pattern === 'quarters' && <path d="M32 2H62V32H32ZM2 32H32V62H2Z" fill={secondary} />}
        {pattern === 'cross' && (
          <path d="M26 2H38V26H62V38H38V62H26V38H2V26H26Z" fill={secondary} />
        )}
        {symbol === 'monogram' ? (
          <>
            <path d="M12 23H52V43H12Z" fill={primary} />
            <text
              x="32"
              y="38"
              textAnchor="middle"
              fontFamily="'Press Start 2P', monospace"
              fontWeight="900"
              fontSize={initials.length > 2 ? 10 : initials.length > 1 ? 15 : 23}
              fill={foreground}
            >
              {initials}
            </text>
          </>
        ) : (
          <>
            <path
              d="M23 11H41V15H49V23H54V43H49V51H41V55H23V51H15V43H10V23H15V15H23Z"
              fill={primary}
            />
            <path
              d={symbols[symbol]}
              fill={
                symbol === 'cannon'
                  ? '#e5b847'
                  : symbol === 'cross' && /vasco/i.test(name)
                    ? '#df3042'
                    : foreground
              }
              fillRule="evenodd"
            />
          </>
        )}
      </g>
      <path d={silhouette} fill="none" stroke={accent} strokeWidth="3" />
      <path d={silhouette} fill="none" stroke="#14181c" strokeWidth="1" />
    </svg>
  );
}
