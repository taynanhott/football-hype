import availableFlags from './country-flags.json';
const names = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
const horizontal: Record<string, string[]> = {
  AR: ['#75bcec', '#fff', '#75bcec'],
  UY: ['#fff', '#5b9ee5', '#fff', '#5b9ee5', '#fff', '#5b9ee5', '#fff'],
  ES: ['#bd182b', '#ffd544', '#ffd544', '#bd182b'],
  DE: ['#171717', '#dc2437', '#ffcf37'],
  CO: ['#ffdb26', '#ffdb26', '#1647aa', '#cf263d'],
  PY: ['#d7293e', '#fff', '#244caa'],
  CL: ['#fff', '#d82735'],
  PE: ['#d62438', '#fff', '#d62438'],
  NL: ['#c93242', '#fff', '#284d9b'],
  RU: ['#fff', '#2457a7', '#cf283b'],
  EC: ['#ffdb26', '#ffdb26', '#1748a4', '#cf273a'],
};
const vertical: Record<string, string[]> = {
  FR: ['#234c9c', '#fff', '#e13948'],
  IT: ['#24925b', '#fff', '#db3646'],
  PT: ['#187b48', '#c92437', '#c92437'],
  BE: ['#171717', '#ffd630', '#df293c'],
  MX: ['#168456', '#fff', '#ce2d40'],
};
/** Small grid-drawn flags stay crisp at the size previously used by country codes. */
export function CountryFlag({ country }: { country: string }) {
  const code = country.toUpperCase();
  const label = names.of(code) ?? code;
  if (availableFlags.includes(code)) {
    return (
      <img
        className="country-pixel-flag"
        src={'/flags/' + code + '.png'}
        alt={label}
        title={label}
        width="20"
        height="14"
      />
    );
  }
  const pixels: { x: number; y: number; color: string }[] = [];
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 18; x++) {
      let color = '#e7edf0';
      if (horizontal[code]) {
        const stripes = horizontal[code]!;
        color = stripes[Math.floor((y * stripes.length) / 12)]!;
      }
      if (vertical[code]) {
        const stripes = vertical[code]!;
        color = stripes[Math.floor((x * stripes.length) / 18)]!;
      }
      if (code === 'BR') {
        color = '#168446';
        if (Math.abs(x - 8.5) / 8 + Math.abs(y - 5.5) / 5 < 1) color = '#ffda32';
        if ((x - 8.5) ** 2 + (y - 5.5) ** 2 < 12) color = '#2355aa';
        if (y === 6 && x > 5 && x < 12) color = '#fff';
      }
      if (code === 'AR' && x >= 8 && x <= 10 && y >= 5 && y <= 7) color = '#e9b534';
      if (code === 'UY' && x < 6 && y < 6)
        color = x > 1 && x < 5 && y > 1 && y < 5 ? '#edbd32' : '#fff';
      if (code === 'PT' && x >= 5 && x <= 8 && y >= 4 && y <= 8) color = '#f2d143';
      if (code === 'GB') {
        color = '#244478';
        if (Math.abs(x - y * 1.5) < 2 || Math.abs(17 - x - y * 1.5) < 2) color = '#fff';
        if ((x >= 7 && x <= 10) || (y >= 4 && y <= 7)) color = '#fff';
        if (x === 8 || x === 9 || y === 5 || y === 6) color = '#d52d43';
      }
      if (code === 'US') {
        color = y % 2 ? '#fff' : '#ce3042';
        if (x < 8 && y < 7) color = x % 2 && y % 2 ? '#fff' : '#294879';
      }
      if (code === 'JP') color = (x - 8.5) ** 2 + (y - 5.5) ** 2 < 12 ? '#ca2940' : '#fff';
      pixels.push({ x, y, color });
    }
  return (
    <svg
      className="country-pixel-flag"
      viewBox="0 0 18 12"
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <title>{label}</title>
      {pixels.map((p) => (
        <rect key={p.y * 18 + p.x} x={p.x} y={p.y} width="1" height="1" fill={p.color} />
      ))}
    </svg>
  );
}
