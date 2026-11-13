import { expect, it } from 'vitest';
import type { WorldState } from '@football/shared';
import { newsPlayerMentions } from '../src/features/market/news-player-mentions';

function players(names: string[]) {
  return Object.fromEntries(
    names.map((name, i) => [String(i), { id: String(i), name }]),
  ) as WorldState['players']['byId'];
}

it('mantém Neymar ligado ao craque, independentemente da ordem dos homônimos', () => {
  for (const names of [
    ['Neymar', 'Neymar Uribe'],
    ['Neymar Uribe', 'Neymar'],
  ]) {
    const mentions = newsPlayerMentions(players(names));
    expect(mentions.get('Neymar')?.id).toBe(String(names.indexOf('Neymar')));
    expect(mentions.get('Neymar Uribe')?.id).toBe(String(names.indexOf('Neymar Uribe')));
  }
});

it('reconhece os nomes de Junior sem vincular a resenha a um homônimo ausente o craque', () => {
  for (const name of [
    'Neymar Junior',
    'Neymar Júnior',
    'Neymar Jr.',
    'Neymar da Silva Santos Júnior',
  ]) {
    expect(newsPlayerMentions(players([name, 'Neymar Uribe'])).get('Neymar')?.id).toBe('0');
  }
  expect(newsPlayerMentions(players(['Neymar Uribe'])).has('Neymar')).toBe(false);
});
