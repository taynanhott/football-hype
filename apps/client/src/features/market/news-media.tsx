import { clubKit, resolvedStadiumSkin, type ClubSnapshot, type WorldState } from '@football/shared';
import { NewsActionArt } from './news-action-art';
const stadiumSkins = [
  'maracana',
  'mineirao',
  'arena-mrv',
  'neo-quimica',
  'sao-januario',
  'beira-rio',
  'arena-gremio',
  'nilton-santos',
  'palmeiras-park',
  'morumbi',
  'vila-belmiro',
  'arena-baixada',
];
/** Editorial illustrations are selected consistently for each publication. */
export function NewsMedia({
  id,
  title,
  body,
  stadium,
  homeClub,
  awayClub,
}: {
  id: string;
  title: string;
  body: string;
  reporter?: unknown;
  stadium?: WorldState['stadiums']['byId'][string] | undefined;
  homeClub?: ClubSnapshot | undefined;
  awayClub?: ClubSnapshot | undefined;
}) {
  if (id.startsWith('coach-change:'))
    return (
      <figure className="news-media news-media-illustrated news-coach-press-image">
        <img
          src="/images/news/coach-press-conference-pixel.png"
          alt="Coletiva de imprensa de apresentação do novo treinador"
          loading="lazy"
          decoding="async"
          width={1672}
          height={941}
        />
      </figure>
    );
  const seed = Array.from(id).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const text = `${title} ${body}`;
  const serious = /les[ãõ]|expuls|elimina|rebaix|suspens/i.test(text);
  const trophy = /campe[ãõ]|conquist.*título|ergue.*taça/i.test(text);
  const score = id.startsWith('score:');
  const scoreStart = score && homeClub ? title.indexOf(homeClub.name) : -1;
  const caption = scoreStart >= 0 ? title.slice(scoreStart) : title;
  if ((!score && !serious && !trophy) || seed % 3 === 0) return null;
  const mode = serious ? 'tv' : trophy ? 'trophy' : seed % 2 ? 'action' : 'stadium';
  const capacity = stadium?.sectors.reduce((sum, sector) => sum + sector.capacity, 0) ?? 0;
  const skin = stadium ? resolvedStadiumSkin(stadium) : undefined;
  const stadiumIndex = skin ? stadiumSkins.indexOf(skin) : -1;
  const genericIndex = capacity < 5000 ? 0 : capacity < 15000 ? 1 : capacity < 30000 ? 2 : 3;
  const actionIndex = (seed >>> 3) % 6;
  const artStyle =
    mode === 'action'
      ? {
          backgroundImage: "url('/images/news/actions-v3.webp')",
          backgroundSize: '300% 200%',
          backgroundPosition: `${(actionIndex % 3) * 50}% ${Math.floor(actionIndex / 3) * 100}%`,
        }
      : mode === 'stadium'
        ? skin === 'arena-mrv'
          ? {
              backgroundImage: "url('/images/news/arena-mrv.webp')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : stadiumIndex >= 0
            ? {
                backgroundImage: "url('/images/news/stadiums.webp')",
                backgroundSize: '400% 300%',
                backgroundPosition: `${((stadiumIndex % 4) * 100) / 3}% ${Math.floor(stadiumIndex / 4) * 50}%`,
              }
            : {
                backgroundImage: "url('/images/news/generic-stadiums.webp')",
                backgroundSize: '200% 200%',
                backgroundPosition: `${(genericIndex % 2) * 100}% ${Math.floor(genericIndex / 2) * 100}%`,
              }
        : undefined;
  return (
    <figure className="news-media news-media-illustrated">
      {mode === 'action' ? (
        <NewsActionArt
          variant={actionIndex}
          homeKit={clubKit(homeClub)}
          awayKit={clubKit(awayClub)}
        />
      ) : (
        <div
          className={`news-editorial-art news-editorial-${mode}`}
          style={artStyle}
          role="img"
          aria-label={
            serious
              ? 'Ilustração de um estúdio de notícias esportivas'
              : trophy
                ? 'Ilustração de uma taça e jogadores celebrando'
                : `Ilustração do estádio ${stadium?.name ?? 'do mandante'}`
          }
        />
      )}
      <figcaption className={serious ? 'is-tv' : ''}>
        <small>{score ? 'FIM DE JOGO' : serious ? 'GIRO DO FUTEBOL' : 'CONQUISTA'}</small>
        <strong>{caption}</strong>
        {mode === 'stadium' && stadium && <small>{stadium.name}</small>}
      </figcaption>
    </figure>
  );
}
