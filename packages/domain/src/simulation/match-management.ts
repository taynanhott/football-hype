import {
  FORMATIONS,
  GAMEPLAY,
  type Lineup,
  type MatchResult,
  type PlayerSnapshot,
  type PlayStyle,
} from '@football/shared';
import { positionFactor } from '../game/tactics.js';
type Side = 'home' | 'away';
export type MatchOptions = Partial<Record<Side, { bench: PlayerSnapshot[]; plan: Lineup }>> & {
  /** Controlled referee events for simulations; never populated by player commands. */
  scenarioDismissals?: readonly { side: Side; playerId: string; minute: number }[];
  /** Audit isolation only: keep the number of dismissals exactly as scheduled. */
  scenarioOnlyScheduledDismissals?: boolean;
};
export function matchManagement(
  options: MatchOptions,
  teams: Record<Side, PlayerSnapshot[]>,
  styles: Record<Side, PlayStyle>,
  ratings: Record<string, number>,
  dismissed: Set<string>,
  replace: (out: PlayerSnapshot, incoming: PlayerSnapshot) => void,
  reshape: (side: Side, formation: Lineup['formation']) => void,
  fatigueFactor: (side: Side, entered: number, played: number, id: string) => number = () => 1,
) {
  const substitutions: NonNullable<MatchResult['substitutions']> = [];
  const entered = Object.fromEntries([...teams.home, ...teams.away].map((p) => [p.id, 0]));
  const minutesPlayed: Record<string, number> = {};
  const baseStyles = { ...styles };
  const currentFormations = {
    home: options.home?.plan.formation,
    away: options.away?.plan.formation,
  };
  const fitness = (p: PlayerSnapshot, minute: number, side: Side) =>
    Math.max(
      0,
      p.fitness -
        ((GAMEPLAY.fitnessCost * (minute - (entered[p.id] ?? 0))) / 90) *
          (styles[side] === 'all-out-press' ? 1.5 : styles[side] === 'gegenpress' ? 1.25 : 1) *
          fatigueFactor(side, entered[p.id] ?? 0, minute - (entered[p.id] ?? 0), p.id),
    );
  const update = (minute: number, homeGoals: number, awayGoals: number) => {
    for (const side of ['home', 'away'] as const) {
      const config = options[side];
      if (!config) continue;
      const instructions = config.plan.instructions;
      const lead = side === 'home' ? homeGoals - awayGoals : awayGoals - homeGoals;
      let desiredStyle = baseStyles[side];
      let desiredFormation = config.plan.formation;
      for (const rule of instructions?.situations ?? []) {
        const matches =
          rule.trigger === 'winning-two'
            ? lead >= 2
            : rule.trigger === 'losing-60'
              ? minute >= 60 && lead < 0
              : minute >= 75 && lead === 0;
        if (!matches) continue;
        if (rule.style) desiredStyle = rule.style;
        if (rule.formation && FORMATIONS[rule.formation]) desiredFormation = rule.formation;
      }
      styles[side] = desiredStyle;
      if (currentFormations[side] !== desiredFormation) {
        reshape(side, desiredFormation);
        currentFormations[side] = desiredFormation;
      }
      const available = () => config.bench.filter((p) => entered[p.id] === undefined);
      const swap = (
        out: PlayerSnapshot,
        reserve: PlayerSnapshot,
        reason: NonNullable<MatchResult['substitutions']>[number]['reason'],
      ) => {
        if (substitutions.filter((s) => s.side === side).length >= 5 || dismissed.has(out.id))
          return;
        const incoming = {
          ...reserve,
          position: out.position,
          overall: Math.max(
            1,
            Math.floor(reserve.overall * positionFactor(reserve.position, out.position)),
          ),
        };
        const index = teams[side].findIndex((p) => p.id === out.id);
        if (index < 0) return;
        replace(out, incoming);
        teams[side][index] = incoming;
        entered[incoming.id] = minute;
        minutesPlayed[out.id] = minute - (entered[out.id] ?? 0);
        ratings[incoming.id] = 6;
        substitutions.push({ side, minute, out: out.id, in: incoming.id, reason });
      };
      for (const plan of instructions?.substitutions ?? []) {
        if (instructions?.protected.includes(plan.out)) continue;
        const out = teams[side].find((p) => p.id === plan.out && !dismissed.has(p.id));
        const reserve = available().find((p) => p.id === plan.in);
        const score =
          plan.score === 'always' ||
          (plan.score === 'winning' ? lead > 0 : plan.score === 'drawing' ? lead === 0 : lead < 0);
        if (
          out &&
          reserve &&
          score &&
          (plan.when === 'fatigue'
            ? minute >= 60 && fitness(out, minute, side) < 30
            : minute >= plan.when)
        )
          swap(out, reserve, 'planned');
      }
      if (minute < 60 || minute >= 90 || minute % 5 !== 0) continue;
      const candidates = teams[side]
        .filter(
          (p) =>
            !dismissed.has(p.id) &&
            p.position !== 'GK' &&
            !(instructions?.protected ?? []).includes(p.id) &&
            !(instructions?.substitutions ?? []).some((s) => s.out === p.id),
        )
        .filter((p) => fitness(p, minute, side) < 30 || (ratings[p.id] ?? 6) < 5.8)
        .sort(
          (a, b) =>
            fitness(a, minute, side) - fitness(b, minute, side) ||
            (ratings[a.id] ?? 6) - (ratings[b.id] ?? 6),
        );
      for (const out of candidates) {
        // Reserve capacity and players for every pending mandatory substitution.
        const pending = (instructions?.substitutions ?? []).filter(
          (p) =>
            !instructions?.protected.includes(p.out) &&
            !substitutions.some((s) => s.out === p.out) &&
            teams[side].some((t) => t.id === p.out && !dismissed.has(t.id)),
        );
        if (substitutions.filter((s) => s.side === side).length + pending.length >= 5) break;
        const reserve = available()
          .filter(
            (p) =>
              p.position !== 'GK' &&
              !pending.some((s) => s.in === p.id) &&
              fitness(out, minute, side) + 5 < p.fitness &&
              positionFactor(p.position, out.position) >= 0.85,
          )
          .sort(
            (a, b) =>
              b.overall * positionFactor(b.position, out.position) -
              a.overall * positionFactor(a.position, out.position),
          )[0];
        if (reserve)
          swap(out, reserve, fitness(out, minute, side) < 30 ? 'fatigue' : 'performance');
      }
    }
  };
  return {
    update,
    dismiss: (id: string, minute: number) => {
      if (entered[id] !== undefined && minutesPlayed[id] === undefined)
        minutesPlayed[id] = Math.max(0, minute - entered[id]!);
    },
    substitutions,
    finish: () => {
      for (const id of Object.keys(entered))
        if (minutesPlayed[id] === undefined) minutesPlayed[id] = 90 - entered[id]!;
      return minutesPlayed;
    },
  };
}
