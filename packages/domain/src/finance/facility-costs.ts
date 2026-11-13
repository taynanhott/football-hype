import { ceilMoney, type ClubSnapshot, type WorldState } from '@football/shared';
export const FACILITY_ECONOMY: Record<
  string,
  { name: string; upgrade: number; maintenance: number; growth: number }
> = {
  pitch: { name: 'Gramado', upgrade: 1800000, maintenance: 48000, growth: 1.65 },
  surroundings: { name: 'Entorno', upgrade: 1200000, maintenance: 28800, growth: 1.6 },
  structure: {
    name: 'Estrutura do estádio',
    upgrade: 5600000,
    maintenance: 192000,
    growth: 1.85,
  },
  food: { name: 'Alimentação', upgrade: 900000, maintenance: 21600, growth: 1.6 },
  shirts: { name: 'Loja do clube', upgrade: 700000, maintenance: 14400, growth: 1.6 },
  hospitality: { name: 'Camarotes', upgrade: 3200000, maintenance: 57600, growth: 1.65 },
  fitness: { name: 'Preparação física', upgrade: 1700000, maintenance: 43200, growth: 1.95 },
  medical: { name: 'Departamento médico', upgrade: 2200000, maintenance: 84000, growth: 2.05 },
  scouting: { name: 'Scout', upgrade: 1400000, maintenance: 33600, growth: 1.9 },
  coaching: { name: 'Treinamento', upgrade: 2600000, maintenance: 52800, growth: 2.05 },
  marketing: { name: 'Marketing', upgrade: 1300000, maintenance: 24000, growth: 1.9 },
};
export function upgradePrice(level: number, target = 'structure') {
  const item = FACILITY_ECONOMY[target] ?? FACILITY_ECONOMY.structure!;
  return ceilMoney(item.upgrade * item.growth ** Math.max(0, level - 1), 10000);
}
export function maintenanceForLevel(level: number, target = 'structure') {
  const item = FACILITY_ECONOMY[target] ?? FACILITY_ECONOMY.structure!;
  return ceilMoney(item.maintenance * 1.65 ** Math.max(0, level - 1), 10000);
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
