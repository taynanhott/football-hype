import { portraitAppearance, clubKit, type ClubKit, type PlayerSnapshot } from '@football/shared';

export function Portrait({
  player,
  clubName,
  kit: customKit,
}: {
  player: PlayerSnapshot;
  clubName?: string | undefined;
  kit?: ClubKit | undefined;
}) {
  const { skinTone, hairColor, hairStyle, beardStyle } = portraitAppearance(player);
  const variant = parseInt(player.id.slice(-4), 16) || player.shirtNumber;
  const kit = customKit ?? clubKit({ name: clubName ?? 'Clube' });
  const eyeColor = ['#332b25', '#4c6580', '#68764d', '#2d3339'][variant % 4];
  return (
    <svg
      viewBox="0 0 48 56"
      className="portrait pixel-portrait"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Retrato em pixel art de ${player.name}`}
    >
      <path
        fill="#152b30"
        d="M6 56V45H10V41H17V36H15V32H12V24H10V18H12V10H16V6H32V10H36V18H38V24H36V32H33V36H31V41H38V45H42V56Z"
      />
      <path fill={kit.primary} d="M8 56V46H12V43H19V40H29V43H36V46H40V56Z" />
      <path fill={kit.secondary} opacity=".65" d="M10 46H15V56H10ZM33 46H38V56H33Z" />
      <path fill="#e9e8cd" d="M17 41H21L24 45L27 41H31L27 48H21Z" />
      <path
        fill={skinTone}
        d="M20 33H28V41L24 44L20 41ZM14 17H34V29H32V33H29V36H19V33H16V29H14ZM12 20H14V26H12ZM34 20H36V26H34Z"
      />
      <path
        fill="#000000"
        opacity=".16"
        d="M14 24H17V30H20V33H29V36H19V33H16V29H14ZM20 36H28V39H20Z"
      />
      <path fill="#ffffff" opacity=".14" d="M18 17H25V19H18ZM18 21H20V24H18Z" />
      <path fill={hairColor} d="M17 21H22V22H17ZM27 21H32V22H27Z" />
      <path fill="#f5f0df" d="M17 23H22V25H17ZM27 23H32V25H27Z" />
      <path fill={eyeColor} d="M19 23H21V26H19ZM28 23H30V26H28Z" />
      <path fill="#000000" opacity=".22" d="M24 24H26V29H23V28H24Z" />
      {hairStyle !== 'bald' && (
        <>
          <path
            fill={hairColor}
            d={
              hairStyle === 'curly'
                ? 'M12 20V12H14V8H18V6H22V8H26V6H30V8H34V12H36V20H32V16H28V14H20V16H16V20Z'
                : hairStyle === 'long' || hairStyle === 'braids'
                  ? 'M12 32V12H16V8H32V12H36V32H33V17H29V14H21V17H15V32Z'
                  : 'M13 21V12H16V8H31V10H34V19H31V15H26V17H17V21Z'
            }
          />
          <path fill="#ffffff" opacity=".12" d="M17 10H29V12H17ZM15 13H19V15H15Z" />
          {hairStyle === 'braids' && (
            <path stroke="#151b20" strokeWidth="1" d="M16 11V16M20 9V14M24 9V13M28 9V14M32 12V18" />
          )}
        </>
      )}
      {beardStyle !== 'none' && (
        <path
          fill={hairColor}
          opacity={beardStyle === 'full' ? 1 : 0.35}
          d="M16 28H19V31H22V30H27V31H30V28H33V32H30V35H19V32H16Z"
        />
      )}
      <path fill="#75473f" d="M21 31H27V32H21Z" />
      <path fill="#f9f4df" d="M22 31H26V32H22ZM12 44H16V46H12ZM32 44H36V46H32Z" />
      <path fill="#101f29" opacity=".25" d="M8 53H18V56H8ZM30 53H40V56H30Z" />
      <rect x="31" y="49" width="4" height="4" fill="#e8cf83" />
    </svg>
  );
}
