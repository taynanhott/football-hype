export type PersonAppearance = {
  name: string;
  skin: string;
  hair: string;
  beard: string;
  outfit: string;
  hairColor?: string;
  secondary?: string;
  beardColor?: string;
  glasses?: string;
  glassesColor?: string;
  outfitStyle?: string;
  eyeColor?: string;
};
export function PersonAvatar({
  profile,
  className = '',
}: {
  profile: PersonAppearance;
  className?: string;
}) {
  const hairShapes: Record<string, string> = {
    curto:
      'M18 30V19H21V15H26V12H31V10H43V12H48V15H52V20H55V30H51V23H47V20H42V23H31V21H26V20H23V30Z',
    cacheado:
      'M17 30V20H19V16H22V12H27V9H32V11H36V8H42V10H47V13H52V17H55V22H56V30H51V24H47V21H42V23H36V21H30V23H25V24H22V30Z',
    longo:
      'M17 44V20H20V15H25V12H30V10H44V12H49V15H53V20H55V44H51V24H47V20H41V23H32V21H26V24H22V44Z',
    raspado: 'M20 29V19H24V15H29V12H44V15H49V19H52V29H49V22H44V19H29V20H24V29Z',
    moicano: 'M30 22V11H32V7H40V9H43V21H40V24H34V22Z',
    topete: 'M18 30V19H22V14H27V10H32V6H44V9H49V13H53V20H55V30H51V23H46V19H41V21H29V20H24V30Z',
    franja: 'M18 30V19H22V14H28V11H44V14H50V19H54V30H50V24H46V28H42V25H37V28H33V25H28V27H24V30Z',
    trancas: 'M18 44V19H22V14H28V11H44V14H50V19H54V44H50V23H46V20H42V22H30V20H26V24H22V44Z',
    coque: 'M18 30V19H22V14H28V11H31V6H33V4H41V6H44V11H48V15H52V20H54V30H50V23H46V20H28V22H23V30Z',
    ondulado:
      'M18 30V19H21V15H26V11H32V9H43V11H48V15H52V20H55V30H51V23H47V20H42V22H37V20H32V23H27V21H23V30Z',
  };
  const hair = hairShapes[profile.hair] ?? hairShapes.curto!;
  const hairColor = profile.hairColor ?? '#3c3129';
  const beardColor = profile.beardColor ?? hairColor;
  const outfitStyle = profile.outfitStyle ?? 'agasalho';
  const trim = profile.secondary ?? '#339c6b';
  const shortSleeves = ['polo', 'camisa', 'camiseta'].includes(outfitStyle);
  return (
    <svg
      viewBox="0 0 72 80"
      className={`person-pixel-portrait ${className}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Retrato em pixel art de ${profile.name || 'treinador'}`}
    >
      <g aria-label={`Roupa: ${outfitStyle}`}>
        <path
          fill="#111b20"
          d="M3 78V67H6V62H10V59H15V56H23V53H28V48H45V53H50V56H58V59H63V62H67V67H69V78Z"
        />
        {shortSleeves && <path fill={profile.skin} d="M5 68H17V77H5ZM55 68H67V77H55Z" />}
        <path
          fill={profile.outfit}
          d={
            shortSleeves
              ? 'M5 68V67H8V63H12V60H20V57H27V54H46V57H54V60H61V63H65V68H55V77H17V68Z'
              : 'M5 77V67H8V63H12V60H20V57H27V54H46V57H54V60H61V63H65V68H67V77Z'
          }
        />
        {outfitStyle === 'agasalho' ? (
          <>
            <path
              fill={trim}
              d="M8 64H12V61H20V59H24V62H15V65H11V69H8ZM49 59H54V61H60V64H63V69H60V66H56V64H49Z"
            />
            <path
              fill="#101f1a"
              d="M23 54H29V51H43V54H50V59H53V64H49V69H46V78H25V69H21V64H18V59H23Z"
            />
            <path
              fill={trim}
              d="M24 55H29V53H43V55H48V59H50V63H46V67H43V77H28V67H24V63H21V59H24Z"
            />
            <path
              fill="#fff"
              opacity=".35"
              d="M26 57H30V61H33V63H40V61H45V57H47V63H43V66H29V63H26Z"
            />
            <path fill={profile.outfit} d="M29 66H43V77H29Z" />
            <path fill="#d6dfcd" d="M35 64H37V77H35Z" />
            <path fill="#000" opacity=".25" d="M14 68H16V77H14ZM56 68H58V77H56Z" />
          </>
        ) : outfitStyle === 'terno' ? (
          <>
            <path fill="#eee8d7" d="M28 54H44L40 77H32Z" />
            <path fill={trim} d="M34 58H38V62H37L40 75 36 77 32 75 35 62H34Z" />
            <path
              fill="#000"
              opacity=".35"
              d="M23 55H28L33 77H28L22 66 26 62 21 59ZM45 55H50L52 59 47 62 51 66 44 77H40Z"
            />
            <path fill="#fff" opacity=".15" d="M10 63H14V61H20V59H23V61H17V63H13V66H10Z" />
            <path fill="#111b20" d="M14 67H16V77H14ZM56 67H58V77H56Z" />
            <path fill={trim} d="M48 67H54V69H48Z" />
          </>
        ) : (
          <>
            {outfitStyle === 'camisa' && (
              <path
                fill={trim}
                d="M19 59H24V77H19ZM32 58H40V77H32ZM48 59H53V77H48ZM8 64H12V68H8ZM60 64H64V68H60Z"
              />
            )}
            {outfitStyle === 'polo' ? (
              <>
                <path fill={trim} d="M26 54H31L36 60 41 54H46L42 64 36 61 30 64Z" />
                <path fill="#111b20" d="M35 62H37V70H35Z" />
                <path fill="#e6dfc6" d="M35 64H36V65H35ZM35 68H36V69H35Z" />
              </>
            ) : (
              <path fill={trim} d="M27 54H31V57H33V59H40V57H42V54H46V59H43V62H30V59H27Z" />
            )}
            <path fill={trim} d="M5 67H17V70H5ZM55 67H67V70H55Z" />
            <path fill="#000" opacity=".2" d="M17 67H19V77H17ZM53 67H55V77H53Z" />
            <path fill="#fff" opacity=".12" d="M11 62H19V60H23V62H20V64H13V66H10Z" />
            <path fill={trim} d="M45 65H50V70H45Z" />
          </>
        )}
        <path fill="#000" opacity=".15" d="M5 75H15V77H5ZM57 75H67V77H57Z" />
      </g>
      <path fill="#171b18" d="M25 43H47V53H44V57H40V60H32V57H28V53H25Z" />
      <path fill={profile.skin} d="M28 44H44V52H41V56H32V54H28Z" />
      <path fill="#000" opacity=".19" d="M28 46H44V51H40V53H32V51H28Z" />
      <path
        fill="#151917"
        d="M18 33V20H21V16H26V12H31V10H43V12H48V16H52V20H55V33H58V35H60V40H57V43H53V48H49V52H44V55H29V53H24V49H20V44H16V41H12V34H15V33Z"
      />
      <path
        fill={profile.skin}
        d="M16 34H21V21H24V17H29V14H44V17H49V21H52V34H56V35H58V39H55V41H51V47H47V51H43V53H30V51H26V47H22V41H17V39H14V35H16Z"
      />
      <path
        fill="#000"
        opacity=".18"
        d="M17 35H19V40H17ZM54 35H56V39H54ZM22 29H25V44H28V48H32V51H43V53H30V51H26V47H22ZM48 30H51V43H48Z"
      />
      <path
        fill="#ffe2aa"
        opacity=".4"
        d="M27 25H33V27H27ZM25 28H28V32H25ZM45 27H48V31H45ZM29 43H33V45H29Z"
      />
      {profile.hair !== 'careca' && (
        <g>
          <path fill={hairColor} stroke="#171b18" strokeWidth="1" strokeLinejoin="miter" d={hair} />
          {profile.hair === 'trancas' ? (
            <path
              d="M23 17V23M28 14V21M33 12V20M39 12V20M45 15V21M50 19V30M20 27V42M52 27V42"
              stroke="#171b18"
              strokeWidth="1"
            />
          ) : (
            <path
              fill="#fff"
              opacity=".16"
              d={
                profile.hair === 'moicano'
                  ? 'M33 11H36V19H33Z'
                  : 'M23 19H26V16H31V14H41V16H32V18H27V21H23Z'
              }
            />
          )}
        </g>
      )}
      <path fill="#282820" d="M25 30H32V32H24V31H25ZM41 30H48V31H49V32H41Z" />
      <path fill="#906744" d="M24 33H33V34H24ZM40 33H49V34H40Z" />
      <path fill="#fff3d9" d="M25 34H32V40H25ZM41 34H48V40H41Z" />
      <path fill={profile.eyeColor ?? '#234c40'} d="M28 34H32V39H28ZM42 34H46V39H42Z" />
      <path fill="#132b29" d="M29 35H32V39H29ZM42 35H45V39H42Z" />
      <path fill="#fff" d="M28 34H30V36H28ZM42 34H44V36H42Z" />
      <path fill="#d98a67" opacity=".35" d="M24 41H29V43H24ZM45 41H50V43H45Z" />
      <path fill="#795c3d" d="M35 40H37V42H39V43H34V42H35Z" />
      {profile.beard !== 'nenhuma' && (
        <>
          <path
            fill={beardColor}
            opacity={profile.beard === 'curta' ? 0.5 : 0.95}
            d={
              profile.beard === 'bigode'
                ? 'M30 44H43V46H30Z'
                : profile.beard === 'cavanhaque'
                  ? 'M32 44H41V46H39V52H34V46H32Z'
                  : profile.beard === 'longa'
                    ? 'M22 40H25V45H29V48H44V45H48V40H51V47H48V53H44V57H30V54H26V50H23Z'
                    : 'M22 40H24V44H27V47H31V49H43V47H47V44H49V40H51V46H48V50H44V53H30V51H26V48H23V44H22Z'
            }
          />
          <path
            fill={beardColor}
            opacity=".5"
            d="M25 44H27V47H30V49H33V51H30V50H27V48H25ZM46 46H48V49H45V51H42V49H45Z"
          />
        </>
      )}
      <path fill="#3a3022" d="M30 46H43V47H41V48H32V47H30Z" />
      <path fill="#f9d296" opacity=".6" d="M33 48H40V49H33Z" />
      {['longa', 'cheia', 'curta'].includes(profile.beard) && (
        <path
          fill={beardColor}
          opacity={profile.beard === 'curta' ? 0.5 : 1}
          d="M32 43H35V44H38V43H41V44H44V46H46V49H42V48H39V47H34V48H30V49H27V46H29V44H32Z"
        />
      )}
      {profile.glasses && profile.glasses !== 'nenhum' && (
        <g
          fill={profile.glasses === 'solar' ? '#18252d' : 'none'}
          stroke={profile.glassesColor ?? '#222b30'}
          strokeWidth="1.5"
        >
          <path
            d={
              profile.glasses === 'redondo'
                ? 'M24 34H26V33H31V34H33V39H31V41H26V40H24ZM40 34H42V33H47V34H49V39H47V41H42V40H40Z'
                : 'M23 33H34V41H23ZM39 33H50V41H39Z'
            }
          />
          <path d="M34 35H39M19 34H23M50 34H54" />
        </g>
      )}
      <path fill="#263128" d="M34 51H39V52H34Z" />
    </svg>
  );
}
export function GeneratedPerson({
  name,
  className = '',
  outfit = '#243e52',
}: {
  name: string;
  className?: string;
  outfit?: string;
}) {
  const feminine = /Helena|Médica|Diretora/.test(name);
  let seed = 0;
  for (const char of name) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0;
  return (
    <PersonAvatar
      className={className}
      profile={{
        name,
        outfit,
        skin: ['#f3d6b5', '#dfb18a', '#c58d65', '#9b6346', '#70452f', '#432b22'][seed % 6]!,
        hair: feminine ? 'longo' : ['curto', 'cacheado', 'longo', 'careca'][(seed >>> 4) % 4]!,
        beard: feminine ? 'nenhuma' : ['nenhuma', 'curta', 'cheia'][(seed >>> 8) % 3]!,
        hairColor: ['#302820', '#5c3e29', '#9b743f', '#77716b'][(seed >>> 12) % 4]!,
      }}
    />
  );
}
