/** Reference windows: CBF 2026 calendar and CONMEBOL 2026 club manuals.
 * Competition formats remain those implemented by the game. Future years project
 * these reference windows; they are not official future-year fixture lists.
 */
export const SEASON_CALENDAR_VERSION = 202610;
const DAY = 86400000;
export function seasonStart(year: number): number {
  return Date.UTC(year, 0, 11, 11);
}
const at = (year: number, date: string, cup: boolean) =>
  Date.parse(`${year}-${date}T${cup ? '23:30' : '19:00'}:00Z`);
const windows: Record<string, [string, string, number[]]> = {
  'serie-a': ['01-28', '12-02', [0, 3]],
  'serie-b': ['03-21', '11-28', [2, 5, 6]],
  'serie-c': ['04-05', '10-25', [0, 3]],
  libertadores: ['04-08', '05-27', [3]],
  'sul-americana': ['04-08', '05-27', [3]],
  'copa-brasil': ['02-18', '12-06', [3, 0]],
  'copa-nordeste': ['03-25', '06-07', [3, 0]],
  'copa-verde': ['03-25', '06-07', [3, 0]],
  'copa-norte': ['03-25', '06-07', [3, 0]],
  'copa-sul-sudeste': ['03-25', '06-07', [3, 0]],
};
const serieA = [
  '01-28',
  '02-04',
  '02-11',
  '02-25',
  '03-11',
  '03-15',
  '03-18',
  '03-22',
  '04-02',
  '04-05',
  '04-12',
  '04-19',
  '04-26',
  '05-03',
  '05-10',
  '05-17',
  '05-24',
  '05-31',
  '07-22',
  '07-26',
  '07-29',
  '08-09',
  '08-16',
  '08-23',
  '08-30',
  '09-06',
  '09-13',
  '09-20',
  '10-07',
  '10-11',
  '10-18',
  '10-25',
  '10-28',
  '11-04',
  '11-18',
  '11-22',
  '11-29',
  '12-02',
];
export function competitionDates(
  id: string,
  year: number,
  count: number,
  knockout = false,
): number[] {
  if (!count) return [];
  if (id === 'serie-a' && count <= 38)
    return serieA.slice(0, count).map((date) => at(year, date, false));
  if (id === 'copa-brasil' && knockout && count === 5)
    return ['02-18', '04-22', '08-26', '11-01', '12-06'].map((date) => at(year, date, true));
  const continental = id === 'libertadores' || id === 'sul-americana';
  if (continental && !knockout && count <= 6)
    return ['04-08', '04-15', '04-29', '05-06', '05-20', '05-27']
      .slice(0, count)
      .map((date) => at(year, date, true));
  if (continental && knockout)
    return ['08-12', '09-09', '10-14', id === 'sul-americana' ? '11-21' : '11-28']
      .slice(0, count)
      .map((date) => at(year, date, true));
  if (id === 'pre-libertadores') return ['02-18', '03-04'].map((date) => at(year, date, true));
  const regional = id.startsWith('copa-') && id !== 'copa-brasil';
  const window =
    windows[id] ??
    ((id.startsWith('estadual-') ||
    id.includes('mineiro') ||
    id.includes('paulista') ||
    id.includes('carioca')
      ? ['01-11', '03-08', [0, 3]]
      : ['01-11', '12-06', [0, 3]]) as [string, string, number[]]);
  let begin = at(year, window[0], id.startsWith('copa-'));
  let end = at(year, window[1], id.startsWith('copa-'));
  if (regional && knockout) {
    begin = at(year, '05-20', true);
    end = at(year, '06-07', true);
  }
  if (regional && !knockout) end = at(year, '05-13', true);
  const candidates: number[] = [];
  for (let day = begin; day <= end; day += DAY) {
    const md = new Date(day).toISOString().slice(5, 10);
    const pause = (id === 'serie-a' || id === 'serie-b') && md >= '06-01' && md <= '07-19';
    if (!pause && window[2].includes(new Date(day).getUTCDay())) candidates.push(day);
  }
  if (!candidates.length) return Array.from({ length: count }, (_, i) => begin + i * 7 * DAY);
  return Array.from(
    { length: count },
    (_, i) => candidates[Math.round((i * (candidates.length - 1)) / Math.max(1, count - 1))]!,
  );
}

export function cupReturnDate(competitionId: string, firstLegAt: number): number {
  const date = new Date(firstLegAt);
  if (competitionId === 'copa-brasil' && date.getUTCMonth() === 3 && date.getUTCDate() === 22)
    return at(date.getUTCFullYear(), '05-13', true);
  return firstLegAt + 7 * DAY;
}
