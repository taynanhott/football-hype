import type { PlayerSnapshot } from '@football/shared';

const fieldOrder = [
  'GK',
  'CB',
  'RB',
  'LB',
  'RWB',
  'LWB',
  'DM',
  'CM',
  'RM',
  'LM',
  'AM',
  'RW',
  'LW',
  'SS',
  'ST',
];
export function compareFieldPosition(a: PlayerSnapshot, b: PlayerSnapshot) {
  const rank = (position: string) => {
    const index = fieldOrder.indexOf(position);
    return index < 0 ? fieldOrder.length : index;
  };
  return (
    rank(a.position) - rank(b.position) ||
    b.overall - a.overall ||
    a.name.localeCompare(b.name, 'pt-BR')
  );
}

const categories = [
  { title: 'Goleiros', singular: 'goleiro', plural: 'goleiros', positions: ['GK'] },
  { title: 'Zagueiros', singular: 'zagueiro', plural: 'zagueiros', positions: ['CB'] },
  {
    title: 'Laterais',
    singular: 'lateral',
    plural: 'laterais',
    positions: ['RB', 'LB', 'RWB', 'LWB'],
  },
  { title: 'Volantes', singular: 'volante', plural: 'volantes', positions: ['DM'] },
  { title: 'Meias', singular: 'meia', plural: 'meias', positions: ['CM', 'RM', 'LM', 'AM'] },
  { title: 'Pontas', singular: 'ponta', plural: 'pontas', positions: ['RW', 'LW'] },
  {
    title: 'Atacantes',
    singular: 'atacante',
    plural: 'atacantes',
    positions: ['SS', 'ST'],
  },
];
export function playerPositionCategory(position: string) {
  return (
    categories.find((category) => category.positions.includes(position)) ?? {
      title: 'Outros',
      singular: 'jogador',
      plural: 'jogadores',
      positions: [position],
    }
  );
}
export function playerCategoryHeading(players: PlayerSnapshot[], index: number) {
  const player = players[index];
  if (!player) return null;
  const category = playerPositionCategory(player.position);
  const previous = players[index - 1];
  if (previous && playerPositionCategory(previous.position).title === category.title) return null;
  const count = players.filter(
    (entry) => playerPositionCategory(entry.position).title === category.title,
  ).length;
  return category.title + ' — ' + count + ' ' + (count === 1 ? category.singular : category.plural);
}
