/** Game season windows. Domestic leagues run through June without a World Cup pause.
 * These are simulation dates, not official future-year fixture lists.
 */
export const SEASON_CALENDAR_VERSION = 202611;
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
export function competitionDates(
  id: string,
  year: number,
  count: number,
  knockout = false,
): number[] {
  if (!count) return [];
  if (id === 'copa-brasil' && knockout && count === 5)
    return ['02-18', '04-22', '08-26', '11-01', '12-06'].map((date) => at(year, date, true));
  const continental = id === 'libertadores' || id === 'sul-americana';
  if (continental && !knockout && count <= 6)
    return ['04-08', '04-15', '04-29', '05-06', '05-20', '05-27']
      .slice(0, count)
      .map((date) => at(year, date, true));
  if (continental && knockout) {
    const dates = ['08-12', '09-09', '10-14', id === 'sul-americana' ? '11-21' : '11-28'];
    return [...dates.slice(0, count - 1), dates.at(-1)!].map((date) => at(year, date, true));
  }
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
    if (window[2].includes(new Date(day).getUTCDay())) candidates.push(day);
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
