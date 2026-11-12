import type { MatchResult } from '@football/shared';
type Action = NonNullable<MatchResult['actions']>[number];
type Window = { from: number; to: number; start: number; end: number };
const cache = new WeakMap<readonly Action[], Window[]>();
/** Give contact, saves and chases readable screen time, preserving the 90s duration and half-time. */
export function presentationGameMinute(actions: readonly Action[], clockMinute: number): number {
  if (clockMinute >= 90) return 90;
  if (clockMinute <= 0 || !actions.length) return Math.max(0, clockMinute);
  let windows = cache.get(actions);
  if (!windows) {
    windows = [];
    for (const half of [0, 45]) {
      const end = half + 45,
        marks = [
          ...new Set([
            half,
            ...actions.filter((a) => a.minute > half && a.minute < end).map((a) => a.minute),
            end,
          ]),
        ].sort((a, b) => a - b);
      const weights = marks.slice(0, -1).map((minute, i) => {
        const events = actions.filter((a) => a.minute === minute),
          duration = marks[i + 1]! - minute;
        const important = events.some((a) => a.type === 'shot' || a.type === 'save')
          ? 0.85
          : events.some((a) => a.throughBall || a.type === 'cross')
            ? 0.55
            : 0;
        return Math.max(0.25, Math.min(1, duration)) + important;
      });
      const sum = weights.reduce((a, b) => a + b, 0);
      let at = half;
      weights.forEach((w, i) => {
        const next = i === weights.length - 1 ? end : at + (w / sum) * 45;
        windows!.push({ from: at, to: next, start: marks[i]!, end: marks[i + 1]! });
        at = next;
      });
    }
    cache.set(actions, windows);
  }
  const window = windows.find((w) => clockMinute >= w.from && clockMinute < w.to);
  if (!window) return clockMinute;
  return (
    window.start +
    ((window.end - window.start) * (clockMinute - window.from)) / (window.to - window.from)
  );
}
