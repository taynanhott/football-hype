import type { ClubSnapshot } from '../types/snapshots.js';
import type { ClubCrest } from '../schemas/club-crest.js';
import { clubKit } from './club-identity.js';

type Profile = [string, ClubCrest['shape'], ClubCrest['pattern'], ClubCrest['symbol'], string?];
const normalize = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
// Deliberately simplified heraldry; no downloaded logos or generated image assets.
const profiles: Profile[] = [
  ['Flamengo', 'pointed', 'hoops', 'monogram', 'CRF'],
  ['Corinthians', 'round', 'solid', 'anchor', 'SCCP'],
  ['Palmeiras', 'round', 'solid', 'monogram', 'P'],
  ['Santos', 'shield', 'stripes', 'ball', 'SFC'],
  ['São Paulo', 'pennant', 'split', 'monogram', 'SPFC'],
  ['Fluminense', 'pointed', 'split', 'monogram', 'FFC'],
  ['Vasco|Vasco da Gama', 'shield', 'sash', 'cross', 'CRVG'],
  ['Botafogo', 'shield', 'solid', 'star', 'BFR'],
  ['Cruzeiro', 'round', 'solid', 'stars', 'CEC'],
  ['Grêmio', 'round', 'stripes', 'ball', 'GFB'],
  ['Internacional', 'round', 'solid', 'monogram', 'SCI'],
  ['Bahia', 'round', 'stripes', 'ball', 'ECB'],
  ['Fortaleza', 'pennant', 'split', 'monogram', 'FEC'],
  ['Atlético-MG|Atlético Mineiro', 'pointed', 'stripes', 'monogram', 'CAM'],
  ['Athletico-PR|Athletico Paranaense', 'pointed', 'sash', 'monogram', 'CAP'],
  ['Coritiba', 'round', 'solid', 'monogram', 'CFC'],
  ['Goiás', 'round', 'solid', 'monogram', 'G'],
  ['América-MG|América Mineiro', 'shield', 'stripes', 'monogram', 'AFC'],
  ['Sport|Sport Recife|Sport Club do Recife', 'shield', 'hoops', 'lion', 'SCR'],
  ['Vitória', 'shield', 'stripes', 'monogram', 'ECV'],
  ['Ceará', 'pointed', 'stripes', 'monogram', 'CSC'],
  ['Náutico', 'oval', 'stripes', 'anchor', 'CNC'],
  ['Santa Cruz', 'shield', 'hoops', 'cross', 'SC'],
  ['Remo', 'shield', 'solid', 'monogram', 'CR'],
  ['Paysandu', 'shield', 'stripes', 'star', 'PSC'],
  ['Chapecoense', 'round', 'solid', 'monogram', 'ACF'],
  ['Criciúma', 'pointed', 'stripes', 'ball', 'CEC'],
  ['Guarani', 'round', 'solid', 'monogram', 'GFC'],
  ['Juventude', 'round', 'stripes', 'monogram', 'ECJ'],
  ['Red Bull Bragantino|Bragantino', 'shield', 'solid', 'ball', 'RBB'],
  ['Arsenal', 'shield', 'solid', 'cannon', 'AFC'],
  ['Manchester City', 'round', 'solid', 'bird', 'MC'],
  ['Manchester United', 'shield', 'split', 'lion', 'MU'],
  ['Liverpool', 'shield', 'solid', 'bird', 'LFC'],
  ['Chelsea', 'round', 'solid', 'lion', 'CFC'],
  ['Tottenham Hotspur', 'oval', 'solid', 'bird', 'TH'],
  ['Newcastle United', 'shield', 'stripes', 'tower', 'NU'],
  ['Everton', 'shield', 'solid', 'tower', 'EFC'],
  ['Nottingham Forest', 'shield', 'solid', 'tree', 'NF'],
  ['West Ham United', 'shield', 'solid', 'cross', 'WH'],
  ['Aston Villa', 'shield', 'solid', 'lion', 'AV'],
  ['Leicester City', 'round', 'solid', 'lion', 'LC'],
  ['Crystal Palace', 'shield', 'stripes', 'bird', 'CP'],
  ['Brighton & Hove Albion', 'round', 'solid', 'bird', 'BHA'],
  ['Wolverhampton Wanderers', 'diamond', 'solid', 'lion', 'W'],
  ['Real Madrid', 'round', 'sash', 'crown', 'RM'],
  ['Barcelona|FC Barcelona', 'shield', 'quarters', 'cross', 'FCB'],
  ['Atlético de Madrid|Atlético Madrid', 'shield', 'stripes', 'tree', 'ATM'],
  ['Athletic Bilbao|Athletic Club', 'shield', 'stripes', 'tree', 'AC'],
  ['Real Betis', 'pennant', 'stripes', 'crown', 'RB'],
  ['Valencia', 'shield', 'stripes', 'bird', 'VCF'],
  ['Sevilla', 'shield', 'split', 'ball', 'SFC'],
  ['Real Sociedad', 'round', 'stripes', 'crown', 'RS'],
  ['Villarreal', 'diamond', 'solid', 'crown', 'VCF'],
  ['Bayern Munich|FC Bayern München', 'round', 'quarters', 'monogram', 'FCB'],
  ['Borussia Dortmund', 'round', 'solid', 'monogram', 'BVB'],
  ['Bayer 04 Leverkusen|Bayer Leverkusen', 'shield', 'solid', 'lion', 'B04'],
  ['RB Leipzig', 'shield', 'solid', 'ball', 'RBL'],
  ['Eintracht Frankfurt', 'round', 'solid', 'bird', 'SGE'],
  ['Werder Bremen', 'diamond', 'solid', 'monogram', 'W'],
  ['VfL Wolfsburg', 'round', 'solid', 'monogram', 'W'],
  ['VfB Stuttgart', 'shield', 'hoops', 'monogram', 'VFB'],
  ['Juventus', 'oval', 'stripes', 'monogram', 'J'],
  ['Inter Milan|Internazionale', 'round', 'solid', 'monogram', 'IM'],
  ['AC Milan', 'oval', 'stripes', 'cross', 'ACM'],
  ['Napoli', 'round', 'solid', 'monogram', 'N'],
  ['Roma|AS Roma', 'shield', 'split', 'lion', 'ROMA'],
  ['Lazio', 'shield', 'stripes', 'bird', 'SSL'],
  ['Atalanta BC|Atalanta', 'oval', 'stripes', 'monogram', 'A'],
  ['Fiorentina', 'diamond', 'solid', 'cross', 'F'],
  ['Torino', 'shield', 'solid', 'lion', 'TOR'],
  ['Paris Saint-Germain|Paris Saint Germain', 'round', 'solid', 'tower', 'PSG'],
  ['Olympique Marseille|Marseille', 'oval', 'solid', 'monogram', 'OM'],
  ['Olympique Lyonnais|Lyon', 'shield', 'split', 'lion', 'OL'],
  ['Monaco|AS Monaco', 'shield', 'stripes', 'crown', 'ASM'],
  ['LOSC Lille|Lille', 'shield', 'solid', 'lion', 'LOSC'],
  ['Benfica|SL Benfica', 'shield', 'split', 'bird', 'SLB'],
  ['Porto|FC Porto', 'round', 'stripes', 'crown', 'FCP'],
  ['Sporting CP|Sporting Lisbon', 'shield', 'hoops', 'lion', 'SCP'],
  ['Ajax', 'round', 'solid', 'monogram', 'AJAX'],
  ['PSV Eindhoven|PSV', 'oval', 'stripes', 'monogram', 'PSV'],
  ['Feyenoord', 'round', 'split', 'monogram', 'F'],
  ['Celtic', 'round', 'solid', 'cross', 'CFC'],
  ['Rangers', 'round', 'solid', 'lion', 'RFC'],
  ['Boca Juniors', 'shield', 'hoops', 'stars', 'CABJ'],
  ['River Plate', 'shield', 'sash', 'monogram', 'CARP'],
  ['Racing Club', 'shield', 'stripes', 'monogram', 'RC'],
  ['Independiente', 'shield', 'solid', 'monogram', 'CAI'],
  ['San Lorenzo', 'shield', 'stripes', 'monogram', 'CASL'],
  ['Peñarol', 'shield', 'stripes', 'stars', 'CAP'],
  ['Nacional', 'shield', 'sash', 'monogram', 'CNF'],
  ['Colo-Colo', 'shield', 'solid', 'monogram', 'CC'],
  ['Universidad de Chile', 'shield', 'solid', 'monogram', 'U'],
];
const byName = new Map(
  profiles.flatMap(([aliases, ...profile]) =>
    aliases.split('|').map((name) => [normalize(name), profile] as const),
  ),
);
// Crest colors are separate from kits: several imported kits are placeholder palettes.
const crestPalettes: [string, string, string, string?][] = [
  [
    'Flamengo|Sport|Sport Recife|Sport Club do Recife|Vitória|Athletico-PR|Athletico Paranaense',
    '#c82032',
    '#15191d',
  ],
  [
    'Corinthians|Santos|São Paulo|Vasco|Vasco da Gama|Atlético-MG|Atlético Mineiro',
    '#f5f3e9',
    '#15191d',
  ],
  [
    'Palmeiras|Coritiba|Goiás|América-MG|América Mineiro|Chapecoense|Guarani|Juventude',
    '#116b43',
    '#f5f3e9',
  ],
  ['Fluminense', '#7f2639', '#16704c', '#f5f3e9'],
  ['Botafogo|Ceará', '#15191d', '#f5f3e9'],
  ['Cruzeiro|Remo', '#174a9b', '#f5f3e9'],
  ['Grêmio', '#48a8d8', '#15191d', '#f5f3e9'],
  ['Bahia|Fortaleza', '#2355ad', '#c82032', '#f5f3e9'],
  ['Internacional|Náutico|Liverpool|Nottingham Forest|Independiente', '#c82032', '#f5f3e9'],
  ['Santa Cruz', '#15191d', '#c82032', '#f5f3e9'],
  ['Paysandu|Napoli|Lazio|Racing Club', '#48a8d8', '#f5f3e9'],
  ['Criciúma|Borussia Dortmund|Wolverhampton Wanderers|Peñarol', '#e8b934', '#15191d'],
  ['Red Bull Bragantino|Bragantino|RB Leipzig', '#f5f3e9', '#c82032'],
  ['Arsenal', '#c82032', '#f5f3e9', '#d9af42'],
  ['Manchester City', '#76b9dc', '#f5f3e9', '#153a71'],
  ['Manchester United', '#c82032', '#e8b934', '#15191d'],
  ['Chelsea|Leicester City|Everton|Porto|FC Porto', '#174a9b', '#f5f3e9'],
  ['Tottenham Hotspur|Ajax|PSV Eindhoven|PSV', '#f5f3e9', '#153a71'],
  ['Newcastle United|Juventus|Colo-Colo', '#f5f3e9', '#15191d'],
  ['West Ham United|Aston Villa', '#7f2639', '#76b9dc'],
  ['Crystal Palace|Barcelona|FC Barcelona|San Lorenzo', '#174a9b', '#a51e3c', '#d9af42'],
  ['Brighton & Hove Albion|Real Sociedad', '#2355ad', '#f5f3e9'],
  ['Real Madrid', '#f5f3e9', '#2355ad', '#d9af42'],
  [
    'Atlético de Madrid|Atlético Madrid|Athletic Bilbao|Athletic Club|Sevilla',
    '#f5f3e9',
    '#c82032',
  ],
  ['Real Betis|Sporting CP|Sporting Lisbon|Celtic', '#116b43', '#f5f3e9'],
  ['Valencia', '#f5f3e9', '#15191d', '#e8b934'],
  ['Villarreal', '#e8b934', '#174a9b'],
  ['Bayern Munich|FC Bayern München', '#c82032', '#f5f3e9', '#2355ad'],
  [
    'Bayer 04 Leverkusen|Bayer Leverkusen|Eintracht Frankfurt|AC Milan',
    '#15191d',
    '#c82032',
    '#f5f3e9',
  ],
  ['Werder Bremen|VfL Wolfsburg', '#168243', '#f5f3e9'],
  ['VfB Stuttgart', '#f5f3e9', '#c82032'],
  ['Inter Milan|Internazionale|Atalanta BC|Atalanta', '#174a9b', '#15191d', '#d9af42'],
  ['Roma|AS Roma|Torino', '#7f2639', '#e8b934'],
  ['Fiorentina', '#713f9c', '#f5f3e9'],
  ['Paris Saint-Germain|Paris Saint Germain', '#153a71', '#c82032', '#f5f3e9'],
  ['Olympique Marseille|Marseille', '#f5f3e9', '#48a8d8', '#d9af42'],
  ['Olympique Lyonnais|Lyon|Monaco|AS Monaco|Benfica|SL Benfica', '#c82032', '#f5f3e9', '#d9af42'],
  ['LOSC Lille|Lille', '#c82032', '#153a71', '#f5f3e9'],
  ['Feyenoord', '#c82032', '#f5f3e9', '#15191d'],
  ['Rangers', '#174a9b', '#f5f3e9', '#c82032'],
  ['Boca Juniors', '#153a71', '#e8b934'],
  ['River Plate|Nacional', '#f5f3e9', '#c82032', '#153a71'],
  ['Universidad de Chile', '#153a71', '#c82032', '#f5f3e9'],
];
const palettesByName = new Map(
  crestPalettes.flatMap(([aliases, ...colors]) =>
    aliases.split('|').map((name) => [normalize(name), colors] as const),
  ),
);
const shapes: ClubCrest['shape'][] = ['round', 'oval', 'shield', 'pointed', 'diamond', 'pennant'];

/** Stored descriptors win; legacy clubs get the same local presentation without migration. */
export function clubCrest(
  club: Pick<ClubSnapshot, 'name' | 'kit' | 'crest' | 'abbreviation'>,
): ClubCrest {
  if (club.crest) return club.crest;
  const name = normalize(club.name);
  const kit = clubKit(club);
  const hash = [...name].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7);
  const profile = byName.get(name);
  const palette = palettesByName.get(name);
  return {
    version: 1,
    shape: profile?.[0] ?? shapes[hash % shapes.length]!,
    pattern: profile?.[1] ?? kit.pattern,
    symbol: profile?.[2] ?? 'monogram',
    primary: palette?.[0] ?? kit.primary,
    secondary: palette?.[1] ?? kit.secondary,
    accent: palette?.[2] ?? palette?.[1] ?? kit.tertiary ?? kit.secondary,
    initials:
      profile?.[3] ??
      (club.abbreviation || club.name.replace(/[^a-z0-9]/gi, '').slice(0, 3))
        .slice(0, 4)
        .toUpperCase(),
  };
}
