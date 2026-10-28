import type { ClubSnapshot } from '../types/snapshots.js';
export type ClubKit = {
  primary: string;
  secondary: string;
  tertiary?: string | undefined;
  pattern: 'solid' | 'stripes' | 'hoops' | 'sash';
};
const normalize = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
const profiles: [RegExp, ClubKit][] = [
  [
    /flamengo|sport club do recife|sport recife/,
    { primary: '#c82032', secondary: '#17191d', pattern: 'hoops' },
  ],
  [/palmeiras|juventude|guarani/, { primary: '#116b43', secondary: '#f5f3e9', pattern: 'solid' }],
  [
    /corinthians|santos|ponte preta|operario/,
    { primary: '#f5f3e9', secondary: '#202329', pattern: 'solid' },
  ],
  [
    /sao paulo|santa cruz/,
    { primary: '#f5f3e9', secondary: '#c52d35', tertiary: '#202329', pattern: 'hoops' },
  ],
  [
    /fluminense/,
    { primary: '#7f2639', secondary: '#16704c', tertiary: '#f5f3e9', pattern: 'stripes' },
  ],
  [/gremio/, { primary: '#48a8d8', secondary: '#202329', tertiary: '#f5f3e9', pattern: 'stripes' }],
  [/bahia/, { primary: '#f5f3e9', secondary: '#2254a3', tertiary: '#d52e41', pattern: 'stripes' }],
  [
    /fortaleza|parana clube/,
    { primary: '#2254a3', secondary: '#cc303e', tertiary: '#f5f3e9', pattern: 'hoops' },
  ],
  [
    /cruzeiro|avai|csa|remo|paysandu/,
    { primary: '#2355ad', secondary: '#f5f3e9', pattern: 'solid' },
  ],
  [
    /botafogo|atletico mineiro|atletico-mg|ceara|figueirense|abc futebol/,
    { primary: '#202329', secondary: '#f5f3e9', pattern: 'stripes' },
  ],
  [/vasco|river plate/, { primary: '#202329', secondary: '#f5f3e9', pattern: 'sash' }],
  [
    /internacional|bragantino|nautico|vila nova|america de cali/,
    { primary: '#c72837', secondary: '#f5f3e9', pattern: 'solid' },
  ],
  [
    /athletico|atletico paranaense|atletico goianiense|atletico-go|vitoria/,
    { primary: '#c72837', secondary: '#202329', pattern: 'stripes' },
  ],
  [
    /coritiba|goias|america mineiro|america-mg|chapecoense|cuiaba/,
    { primary: '#247a4b', secondary: '#f5f3e9', pattern: 'stripes' },
  ],
  [
    /criciuma|novorizontino|amazonas/,
    { primary: '#e8b934', secondary: '#202329', pattern: 'stripes' },
  ],
];
const palettes: ClubKit[] = [
  { primary: '#295f4e', secondary: '#f3eddc', pattern: 'solid' },
  { primary: '#b9303d', secondary: '#20252b', pattern: 'stripes' },
  { primary: '#315eaa', secondary: '#f6f2e5', pattern: 'solid' },
  { primary: '#e1b63c', secondary: '#28323b', pattern: 'stripes' },
  { primary: '#713f7d', secondary: '#f3eddf', pattern: 'solid' },
  { primary: '#f3eddf', secondary: '#282e35', pattern: 'sash' },
  { primary: '#9c3e45', secondary: '#f2dfad', pattern: 'hoops' },
  { primary: '#286779', secondary: '#f3eddf', pattern: 'stripes' },
];
/** One club identity for saved careers, imported teams and every match side. */
export function clubKit(club: Pick<ClubSnapshot, 'name' | 'kit'> | undefined): ClubKit {
  if (club?.kit) return club.kit;
  if (!club) return { primary: '#475569', secondary: '#f8fafc', pattern: 'solid' };
  const name = normalize(club.name);
  const known = profiles.find(([pattern]) => pattern.test(name));
  if (known) return { ...known[1] };
  const hash = [...name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0);
  return { ...palettes[hash % palettes.length]! };
}
const colorNames: Record<string, string> = {
  red: '#c72837',
  vermelho: '#c72837',
  white: '#f5f3e9',
  branco: '#f5f3e9',
  black: '#202329',
  preto: '#202329',
  blue: '#2355ad',
  azul: '#2355ad',
  green: '#16704c',
  verde: '#16704c',
  yellow: '#e8b934',
  amarelo: '#e8b934',
  maroon: '#7f2639',
  grená: '#7f2639',
  grena: '#7f2639',
  purple: '#713f7d',
  roxo: '#713f7d',
  orange: '#db7c31',
  laranja: '#db7c31',
  'sky blue': '#48a8d8',
  'light blue': '#48a8d8',
  'dark blue': '#153a71',
  navy: '#153a71',
  gold: '#d6ad40',
  grey: '#8f969b',
  gray: '#8f969b',
};
export function kitFromClubColors(name: string, raw?: string | null): ClubKit {
  const base = clubKit({ name });
  const colors = (raw ?? '').split(/\s*[/,;]\s*/).flatMap((token) => {
    const color =
      colorNames[normalize(token)] ??
      (/^#[\da-f]{6}$/i.test(token.trim()) ? token.trim() : undefined);
    return color ? [color] : [];
  });
  return colors.length >= 2
    ? {
        primary: colors[0]!,
        secondary: colors[1]!,
        ...(colors[2] ? { tertiary: colors[2] } : {}),
        pattern: base.pattern,
      }
    : base;
}
const colorDistance = (a: string, b: string) =>
  Math.hypot(
    ...[1, 3, 5].map(
      (index) => parseInt(a.slice(index, index + 2), 16) - parseInt(b.slice(index, index + 2), 16),
    ),
  );
export function matchKits(
  home: Pick<ClubSnapshot, 'name' | 'kit'> | undefined,
  away: Pick<ClubSnapshot, 'name' | 'kit'> | undefined,
) {
  const first = clubKit(home),
    second = clubKit(away);
  // The visitor's change strip uses its own palette when the primary shirts clash.
  return {
    home: first,
    away:
      colorDistance(first.primary, second.primary) < 90 &&
      colorDistance(first.primary, second.secondary) > 90
        ? { ...second, primary: second.secondary, secondary: second.primary }
        : second,
  };
}
