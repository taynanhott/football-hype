import { useId } from 'react';
export function CompetitionTrophy({
  competitionId: type,
  name,
}: {
  competitionId: string;
  name: string;
}) {
  const id = useId();
  const silver = `url(#${id}s)`,
    gold = `url(#${id}g)`;
  const ball = (x: number, y: number, r: number, fill = gold) => (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} stroke="#aa925e" />
      <path
        d={`M${x} ${y - r * 0.5}l${r * 0.48} ${r * 0.35}-.2 ${r * 0.55}h${-r * 0.56}l${-r * 0.2} ${-r * 0.55}z`}
        fill="none"
        stroke="#82754e"
        strokeWidth=".8"
      />
    </g>
  );
  let shape;
  if (type === 'serie-a')
    shape = (
      <>
        <path d="M18 13L39 119h42L102 13 86 17 74 116H46L34 17Z" fill={silver} />
        <path d="M60 31L86 117H34Z" fill={gold} />
        {ball(60, 78, 17)}
        <path d="M37 119h46l11 24H26Z" fill="#193e30" stroke="#d1b672" strokeWidth="2" />
      </>
    );
  else if (type === 'serie-b')
    shape = (
      <>
        <path d="M28 12h64L75 119H43Z" fill={silver} />
        <path d="M60 46L82 119H38Z" fill={gold} />
        {ball(60, 108, 13)}
        <path d="M34 122h52l15 24H19Z" fill={silver} />
      </>
    );
  else if (type === 'serie-c' || type === 'serie-d')
    shape = (
      <>
        <path d="M33 14Q60 3 87 14L68 96Q67 115 79 128H41Q53 115 52 96Z" fill={silver} />
        <path d="M42 16Q60 10 78 16L61 98Z" fill={type === 'serie-c' ? gold : silver} />
        {ball(60, 31, 12)}
        <path d="M41 129h38l10 17H31Z" fill={silver} />
      </>
    );
  else if (type === 'copa-brasil')
    shape = (
      <>
        <path
          d="M29 28C-2 13 7 75 40 85M91 28c31-15 22 47-11 57"
          fill="none"
          stroke={silver}
          strokeWidth="9"
        />
        <path d="M27 23Q60 10 93 23L82 72Q74 93 60 97 46 93 38 72Z" fill={silver} />
        <path d="M45 30h30v28H45Z" fill="#35495d" stroke="#e9edf0" />
        <path d="M56 33h8v7h7v8h-7v7h-8v-7h-7v-8h7Z" fill={silver} />
        <path d="M54 96h12v16H54Z" fill={gold} />
        <path d="M37 113h46l9 14H28l-6 19h76l-6-19H28Z" fill={silver} />
        <path d="M24 29L20 126l7-8 6 8-2-97M96 29l4 97-7-8-6 8 2-97" fill="#b94924" />
      </>
    );
  else if (type === 'libertadores')
    shape = (
      <>
        <rect x="40" y="89" width="40" height="58" rx="2" fill="#38271f" />
        {[92, 99, 106, 113, 120, 127, 134].map((y) => (
          <g key={y}>
            <path d={'M42 ' + y + 'h36v5H42Z'} fill={silver} />
            <path d={'M54 ' + y + 'v5m12-5v5'} stroke="#655b45" strokeWidth=".7" />
          </g>
        ))}
        <path d="M43 88h34v-4H43ZM47 83Q56 77 56 62V49h8v13q0 15 9 21Z" fill={silver} />
        {ball(60, 35, 15, silver)}
        <path d="M45 34h30v4H45Z" fill="#a79873" />
        <circle cx="59" cy="7" r="2.5" fill={silver} />
        <path d="M59 10l-2 7m2-7 5 5m-7 2-4 5m4-5 7 4" stroke={silver} strokeWidth="2" />
        <path d="M38 147h44v4H38Z" fill="#15232a" />
      </>
    );
  else if (type === 'sul-americana')
    shape = (
      <>
        {ball(60, 35, 25, silver)}
        <path d="M34 36h52v5H34Z" fill={gold} />
        <path
          d="M38 56Q55 88 45 116M82 56Q65 88 75 116"
          fill="none"
          stroke={silver}
          strokeWidth="5"
        />
        <circle cx="60" cy="90" r="8" fill={gold} />
        <path d="M38 118h44v24H38Z" fill="#121e22" stroke="#8b9d9f" strokeWidth="2" />
        <ellipse cx="60" cy="144" rx="28" ry="5" fill={silver} />
      </>
    );
  else if (type === 'intercontinental')
    shape = (
      <>
        {ball(60, 29, 22)}
        <path
          d="M30 40Q57 89 36 129M48 45Q60 86 53 130M72 44Q62 86 68 130M88 40Q65 89 84 129"
          fill="none"
          stroke={silver}
          strokeWidth="7"
        />
        <path d="M35 130h50l10 18H25Z" fill={gold} />
      </>
    );
  else if (type === 'copa-nordeste')
    shape = (
      <>
        <path
          d="M33 27C-6-28-10 83 42 127M87 27c39-55 43 56-9 100"
          fill="none"
          stroke={gold}
          strokeWidth="6"
        />
        <path d="M41 22h38l-9 100H50Z" fill="#987026" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <ellipse
            key={i}
            cx="60"
            cy={29 + i * 12}
            rx={35 - i * 2.4}
            ry="6"
            fill="none"
            stroke={gold}
            strokeWidth="6"
          />
        ))}
        <path d="M20 13l8 84m72-84-8 84" stroke="#125879" strokeWidth="7" />
        <path d="M37 128h46l9 15H28Z" fill={gold} />
        <ellipse cx="60" cy="145" rx="35" ry="5" fill={gold} />
      </>
    );
  else if (type === 'copa-verde')
    shape = (
      <>
        {ball(60, 34, 25, silver)}
        <path d="M41 54Q52 84 37 117h11Q63 84 52 58M79 54l-7 63h-8l8-60" fill={gold} />
        <path d="M33 118h54v27H33Z" fill="#61452b" stroke="#c6c8b4" strokeWidth="2" />
        <path d="M45 121h30v20H45Z" fill="#596447" stroke="#d8dbb5" />
        <path d="M29 116h62v5H29Zm0 27h62v6H29Z" fill="#1c2927" />
      </>
    );
  else if (type === 'copa-sul-sudeste')
    shape = (
      <>
        <path d="M38 10Q59 17 84 13L73 126H48Z" fill={silver} />
        <path d="M60 25q-2 18-16 20 14 1 16 20 2-19 16-20-14-2-16-20Z" fill={gold} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path key={i} d={'M43 ' + (68 + i * 7) + 'l32 13'} stroke="#e8efeb" strokeWidth="1.5" />
        ))}
        <path d="M35 128h50v17H35Z" fill="#222728" />
        <path d="M39 131h42v11H39Z" fill={silver} />
        <path d="M30 146h60v5H30Z" fill="#171d20" />
      </>
    );
  else if (type === 'europa')
    shape = (
      <>
        <path
          d="M32 40C25 35 22 31 28 27C45 20 42 4 29 4C9 3 5 23 7 45C9 69 17 93 28 108M88 40C95 35 98 31 92 27C75 20 78 4 91 4C111 3 115 23 113 45C111 69 103 93 92 108"
          fill="none"
          stroke={silver}
          strokeWidth="5"
        />
        <path d="M30 35Q60 26 90 35L82 85Q78 108 66 117v10H54v-10Q42 108 38 85Z" fill={silver} />
        <ellipse cx="60" cy="35" rx="30" ry="5" fill="#415c68" stroke="#d1e0e3" />
        <circle cx="60" cy="59" r="8" fill="none" stroke="#c3d9df" strokeWidth="1.5" />
        <path d="M54 126h12l8 9H46Z" fill={silver} />
        <ellipse cx="60" cy="142" rx="25" ry="8" fill={silver} />
      </>
    );
  else
    shape = (
      <>
        <path
          d="M30 22h60L77 76 65 96v25H55V96L43 76Z"
          fill={type === 'copa-verde' ? silver : gold}
        />
        <path
          d="M29 27C4 16 10 65 42 71M91 27c25-11 19 38-13 44"
          fill="none"
          stroke={gold}
          strokeWidth="5"
        />
        {ball(60, 45, 14)}
        <path d="M40 123h40l9 12H31Z" fill={silver} />
        <path d="M30 136h60v12H30Z" fill="#24352a" />
      </>
    );
  return (
    <svg width="44" height="58" viewBox="0 0 120 156" role="img" aria-label={'Troféu ' + name}>
      <defs>
        <linearGradient id={id + 's'}>
          <stop stopColor="#647580" />
          <stop offset=".25" stopColor="#e5edf2" />
          <stop offset=".45" stopColor="#94a5af" />
          <stop offset=".6" stopColor="#fcffff" />
          <stop offset=".8" stopColor="#879aa5" />
          <stop offset="1" stopColor="#e2e9ed" />
        </linearGradient>
        <linearGradient id={id + 'g'}>
          <stop stopColor="#7a5926" />
          <stop offset=".3" stopColor="#e9cc78" />
          <stop offset=".55" stopColor="#fff0b0" />
          <stop offset=".8" stopColor="#bc903c" />
          <stop offset="1" stopColor="#e6cd8b" />
        </linearGradient>
      </defs>
      {shape}
    </svg>
  );
}
