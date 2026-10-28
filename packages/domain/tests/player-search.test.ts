import { describe, expect, it } from 'vitest';
import { SearchTrie } from '../src/core/trie.js';

describe('busca flexível por jogadores', () => {
  const index = () => {
    const trie = new SearchTrie();
    for (const [name, id] of [
      ['Lamine Yamal', 'yamal'],
      ['Kylian Mbappé', 'kylian'],
      ['Ethan Mbappé', 'ethan'],
      ['Vinícius José de Oliveira', 'vini'],
    ]) {
      trie.insert(name!, id!);
      for (const token of name!.split(' ')) trie.insert(token, id!);
    }
    return trie;
  };
  it('encontra sobrenomes e trechos sem exigir o nome completo', () => {
    expect(index().search('yama')).toContain('yamal');
    expect(index().search('amal')).toContain('yamal');
    expect(index().search('bapp')).toEqual(expect.arrayContaining(['kylian', 'ethan']));
  });
  it('ignora acentos, caixa e a ordem dos termos', () => {
    expect(index().search('MBAPPE')).toEqual(expect.arrayContaining(['kylian', 'ethan']));
    expect(index().search('yamal lamine')).toContain('yamal');
    expect(index().search('vinicius oliveira')).toContain('vini');
  });
  it('tolera um caractere errado sem duplicar jogadores', () => {
    expect(index().search('mbape')).toEqual(expect.arrayContaining(['kylian', 'ethan']));
    expect(index().search('yamall')).toContain('yamal');
    expect(
      index()
        .search('yamal')
        .filter((id) => id === 'yamal'),
    ).toHaveLength(1);
    expect(index().search('zzzzzzzz')).toHaveLength(0);
  });
});
