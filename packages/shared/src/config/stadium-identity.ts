import type { StadiumSnapshot } from '../types/snapshots.js';
export function linkedStadiumSkin(stadium: StadiumSnapshot) {
  const name = stadium.name.toLowerCase();
  return (
    (name.includes('palmeiras')
      ? 'palmeiras-park'
      : name.includes('são paulo')
        ? 'morumbi'
        : name.includes('santos') && !name.includes('nilton')
          ? 'vila-belmiro'
          : name.includes('athletico')
            ? 'arena-baixada'
            : undefined) ??
    (name.includes('flamengo') || name.includes('fluminense')
      ? 'maracana'
      : name.includes('cruzeiro')
        ? 'mineirao'
        : name.includes('atlético-mg')
          ? 'arena-mrv'
          : name.includes('corinthians')
            ? 'neo-quimica'
            : name.includes('vasco')
              ? 'sao-januario'
              : name.includes('internacional')
                ? 'beira-rio'
                : name.includes('grêmio')
                  ? 'arena-gremio'
                  : name.includes('botafogo') && !name.includes('-')
                    ? 'nilton-santos'
                    : undefined)
  );
}

export function resolvedStadiumSkin(stadium: StadiumSnapshot) {
  const unlocked = stadium.sectors.every((sector) => sector.level >= 4);
  return (unlocked ? stadium.skin : undefined) ?? linkedStadiumSkin(stadium);
}
