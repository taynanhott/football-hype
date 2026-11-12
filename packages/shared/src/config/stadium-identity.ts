import type { StadiumSnapshot } from '../types/snapshots.js';
export function linkedStadiumSkin(stadium: StadiumSnapshot) {
  const name = stadium.name.toLowerCase();
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const stadiumModels: Array<[RegExp, NonNullable<StadiumSnapshot['skin']>]> = [
    [/maracana|jornalista mario filho/, 'maracana'],
    [/mineirao|governador magalhaes pinto/, 'mineirao'],
    [/arena mrv/, 'arena-mrv'],
    [/neo quimica|arena corinthians|itaquerao/, 'neo-quimica'],
    [/sao januario/, 'sao-januario'],
    [/beira rio|jose pinheiro borda/, 'beira-rio'],
    [/arena (do )?gremio/, 'arena-gremio'],
    [/nilton santos|engenhao/, 'nilton-santos'],
    [/allianz (parque|park)|nubank (parque|park)|palestra italia/, 'palmeiras-park'],
    [/morumbi|morumbis|cicero pompeu de toledo/, 'morumbi'],
    [/vila belmiro|urbano caldeira/, 'vila-belmiro'],
    [/arena (da )?baixada|ligga arena|joaquim americo/, 'arena-baixada'],
  ];
  const official = stadiumModels.find(([pattern]) => pattern.test(normalized));
  if (official) return official[1];
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
