export const SAO_JANUARIO_ROWS = 32;
export const SAO_JANUARIO_STEP = 0.68;
export function saoJanuarioOutline(offset: number, y: number): [number, number, number][] {
  const p: [number, number, number][] = [];
  for (let j = 0; j <= 48; j++) p.push([-42 - offset, y, 57 - (j * 97) / 48]);
  for (let j = 1; j <= 64; j++) {
    const a = Math.PI + (j / 64) * Math.PI;
    p.push([(42 + offset) * Math.cos(a), y, -40 + (35 + offset) * Math.sin(a)]);
  }
  for (let j = 1; j <= 48; j++) p.push([42 + offset, y, -40 + (j * 97) / 48]);
  return p;
}
export function saoJanuarioHeight(row: number): number {
  return 1.2 + row * 0.38;
}
const WORD = [
  ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  ['01110', '11011', '10001', '11111', '10001', '10001', '10001'],
  ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
];
export function saoJanuarioPaint(row: number, segment: number): 'white' | 'black' | 'red' {
  if (segment >= 112) {
    const z = -40 + ((segment - 112 + 0.5) * 97) / 48;
    const col = Math.floor((z + 33) / 2.7),
      line = 6 - Math.floor((row - 5) / 3);
    if (line >= 0 && line < 7 && col >= 0 && col < 29) {
      const letter = Math.floor(col / 6),
        x = col % 6;
      if (x < 5 && WORD[letter]?.[line]?.[x] === '1') return 'white';
    }
    return 'black';
  }
  if (segment < 48) return row % 5 === 0 ? 'white' : 'black';
  const a = Math.PI + ((segment - 48 + 0.5) / 64) * Math.PI;
  // White diagonal sash across the curved terrace, with a flared red cross at its centre.
  const u = (a - Math.PI * 1.5) * 45;
  const inSash = Math.abs(u + (row - 16) * 0.8) < 24;
  return inSash ? 'white' : 'black';
}
