import { useId } from 'react';
import { clubCrest, type ClubCrest } from '@football/shared';

const shapes: Record<ClubCrest['shape'], string> = {
  round:
    'M24 3H40V6H48V10H54V16H58V24H61V40H58V48H54V54H48V58H40V61H24V58H16V54H10V48H6V40H3V24H6V16H10V10H16V6H24Z',
  oval: 'M24 2H40V5H48V11H54V20H58V44H54V53H48V59H40V62H24V59H16V53H10V44H6V20H10V11H16V5H24Z',
  shield: 'M6 5H58V37H54V45H48V51H42V56H36V61H28V56H22V51H16V45H10V37H6Z',
  pointed: 'M4 6H60V34H56V42H50V48H44V53H38V58H34V62H30V58H26V53H20V48H14V42H8V34H4Z',
  diamond:
    'M29 2H35V7H40V12H45V17H50V22H55V27H60V37H55V42H50V47H45V52H40V57H35V62H29V57H24V52H19V47H14V42H9V37H4V27H9V22H14V17H19V12H24V7H29Z',
  pennant: 'M3 5H61V23H57V30H51V37H45V44H39V51H35V58H29V51H25V44H19V37H13V30H7V23H3Z',
};
const symbols: Partial<Record<ClubCrest['symbol'], string>> = {
  star: 'M29 15H35V25H45V31H39V37H41V45H35V41H29V45H23V37H25V31H19V25H29Z',
  stars: 'M29 15H35V21H29ZM17 27H23V33H17ZM41 27H47V33H41ZM30 33H36V39H30ZM27 45H33V51H27Z',
  cross: 'M27 14H37V25H49V37H37V49H27V37H15V25H27Z',
  anchor:
    'M28 12H36V16H40V24H35V43H43V35H49V45H45V49H37V53H27V49H19V45H15V35H21V43H29V30H23V25H29V24H24V16H28ZM29 17V21H35V17Z',
  cannon:
    'M12 25H43V22H51V33H43V31H26V35H20V40H10V35H15V31H12ZM32 33H42V37H46V47H42V51H32V47H28V37H32ZM34 38V46H40V38Z',
  ball: 'M23 16H41V20H47V26H51V40H47V46H41V50H23V46H17V40H13V26H17V20H23ZM28 26V38H38V26ZM19 23V28H25V23ZM40 23V28H45V23ZM19 38V43H25V38ZM40 38V43H45V38Z',
  crown: 'M14 21H20V27H26V17H32V27H38V17H44V27H50V21H54V39H50V46H14V39H10V21ZM18 49H46V53H18Z',
  tower: 'M19 16H25V22H29V16H35V22H39V16H45V29H41V45H47V51H17V45H23V29H19ZM29 35V47H35V35Z',
  bird: 'M7 20H15V24H23V28H29V21H35V16H43V21H39V28H35V33H43V28H51V24H59V31H53V36H45V40H37V45H41V50H23V45H27V40H19V36H11V31H7Z',
  lion: 'M23 14H39V19H44V30H39V35H44V40H49V33H54V43H49V48H38V42H32V48H22V52H15V46H22V38H27V31H19V23H23ZM26 20V25H31V20Z',
  tree: 'M27 12H37V17H44V23H49V35H39V40H35V47H43V52H21V47H29V40H25V35H15V23H20V17H27Z',
};
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
