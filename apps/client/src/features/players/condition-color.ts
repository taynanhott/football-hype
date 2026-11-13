export function conditionColor(fitness: number) {
  return `hsl(${Math.max(0, Math.min(100, fitness)) * 1.2} 70% 35%)`;
}
