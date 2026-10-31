import type { StadiumSnapshot } from '@football/shared';
export const STADIUM_SKINS = [
  ['palmeiras-park', 'Nubank Park', '#23764b', 1],
  ['morumbi', 'Morumbi', '#ac343b', 0],
  ['vila-belmiro', 'Vila Belmiro', '#343839', 1],
  ['arena-baixada', 'Arena da Baixada', '#a7aaa6', 1],
  ['maracana', 'Maracanã', '#71a4d5', 0],
  ['mineirao', 'Mineirão', '#b7b5a6', 0],
  ['arena-mrv', 'Arena MRV', '#34383b', 1],
  ['neo-quimica', 'Neo Química Arena', '#eeeeed', 1],
  ['sao-januario', 'São Januário', '#333333', 2],
  ['beira-rio', 'Beira-Rio', '#b72836', 0],
  ['arena-gremio', 'Arena do Grêmio', '#398cb6', 1],
  ['nilton-santos', 'Nilton Santos', '#343c44', 0],
] as const;
export function stadiumSkin(stadium: StadiumSnapshot) {
  const name = stadium.name.toLowerCase();
  return (
    stadium.skin ??
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
