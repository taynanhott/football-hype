import { roundMoney, type ClubSnapshot, type WorldState } from '@football/shared';
export const FACILITY_ECONOMY: Record<
  string,
  { name: string; upgrade: number; maintenance: number; growth: number }
> = {
  pitch: { name: 'Gramado', upgrade: 90000000, maintenance: 3000000, growth: 1.9 },
  surroundings: { name: 'Entorno', upgrade: 60000000, maintenance: 1800000, growth: 1.8 },
  structure: {
    name: 'Estrutura do estádio',
    upgrade: 280000000,
    maintenance: 12000000,
    growth: 2.2,
  },
  food: { name: 'Alimentação', upgrade: 45000000, maintenance: 1350000, growth: 1.8 },
  shirts: { name: 'Loja do clube', upgrade: 35000000, maintenance: 900000, growth: 1.8 },
  hospitality: { name: 'Camarotes', upgrade: 160000000, maintenance: 3600000, growth: 2.1 },
  fitness: { name: 'Preparação física', upgrade: 85000000, maintenance: 2700000, growth: 1.95 },
  medical: { name: 'Departamento médico', upgrade: 110000000, maintenance: 5250000, growth: 2.05 },
  scouting: { name: 'Scout', upgrade: 70000000, maintenance: 2100000, growth: 1.9 },
  coaching: { name: 'Treinamento', upgrade: 130000000, maintenance: 3300000, growth: 2.05 },
  marketing: { name: 'Marketing', upgrade: 65000000, maintenance: 1500000, growth: 1.9 },
};
export function upgradePrice(level: number, target = 'structure') {
  const item = FACILITY_ECONOMY[target] ?? FACILITY_ECONOMY.structure!;
  return roundMoney(item.upgrade * item.growth ** Math.max(0, level - 1));
}
export function maintenanceForLevel(level: number, target = 'structure') {
  const item = FACILITY_ECONOMY[target] ?? FACILITY_ECONOMY.structure!;
  return roundMoney(item.maintenance * 1.65 ** Math.max(0, level - 1));
}
export function facilityCosts(state: WorldState, club: ClubSnapshot) {
  const stadium = state.stadiums.byId[club.stadiumId],
    center = state.centers.byId[club.trainingCenterId];
  if (!stadium || !center) return [];
  const levels = {
    ...center.levels,
    pitch: stadium.pitchLevel,
    surroundings: stadium.surroundingsLevel,
    structure: Math.max(...stadium.sectors.map((s) => s.level)),
    food: stadium.commerce.foodLevel,
    shirts: stadium.commerce.shirtsLevel,
    hospitality: stadium.commerce.hospitalityLevel,
  };
  return Object.entries(levels).map(([target, level]) => ({
    target,
    level,
    cost: maintenanceForLevel(level, target),
    name: FACILITY_ECONOMY[target]?.name ?? target,
  }));
}
export function monthlyStructureCost(state: WorldState, club: ClubSnapshot) {
  return facilityCosts(state, club).reduce((sum, item) => sum + item.cost, 0);
}
