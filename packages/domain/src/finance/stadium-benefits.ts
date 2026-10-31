import type { StadiumSnapshot } from '@football/shared';

/** Quality uses the average sector level so every upgrade remains useful. */
export function stadiumBenefits(stadium: StadiumSnapshot) {
  const structure = stadium.sectors.length
    ? stadium.sectors.reduce((sum, sector) => sum + sector.level, 0) / stadium.sectors.length
    : 1;
  return {
    interest: stadium.pitchLevel * 0.02 + stadium.surroundingsLevel * 0.03 + structure * 0.02,
    ticketPremium:
      stadium.pitchLevel * 0.025 + stadium.surroundingsLevel * 0.015 + structure * 0.03,
    commerce:
      stadium.commerce.foodLevel * 1.5 +
      stadium.commerce.shirtsLevel +
      stadium.commerce.hospitalityLevel * 4,
  };
}
