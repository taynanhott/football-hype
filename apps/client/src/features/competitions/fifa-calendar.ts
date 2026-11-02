import { GAMEPLAY } from '@football/shared';

export function fifaCalendarBoundary(day: string) {
  const window = GAMEPLAY.fifaWindows.find(
    (item) => item.start.slice(5) === day.slice(5) || item.end.slice(5) === day.slice(5),
  );
  if (!window) return undefined;
  return {
    start: day.slice(0, 4) + window.start.slice(4),
    end: day.slice(0, 4) + window.end.slice(4),
    kind: window.start.slice(5) === day.slice(5) ? 'Início' : 'Fim',
  };
}
