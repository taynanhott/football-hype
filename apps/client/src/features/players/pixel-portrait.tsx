import { portraitAppearance, clubKit, type ClubKit, type PlayerSnapshot } from '@football/shared';
import { PersonAvatar } from '../../ui/person-avatar';
export function Portrait({
  player,
  clubName,
  kit: customKit,
}: {
  player: PlayerSnapshot;
  clubName?: string | undefined;
  kit?: ClubKit | undefined;
}) {
  const appearance = portraitAppearance(player);
  const kit = customKit ?? clubKit({ name: clubName ?? 'Clube' });
  return (
    <PersonAvatar
      className="portrait pixel-portrait"
      profile={{
        name: player.name,
        skin: appearance.skinTone,
        hairColor: appearance.hairColor,
        hair: { short: 'curto', curly: 'cacheado', bald: 'careca', braids: 'longo', long: 'longo' }[
          appearance.hairStyle
        ],
        beard:
          appearance.beardStyle === 'none'
            ? 'nenhuma'
            : appearance.beardStyle === 'full'
              ? 'cheia'
              : 'curta',
        outfit: kit.primary,
        secondary: kit.secondary,
      }}
    />
  );
}
