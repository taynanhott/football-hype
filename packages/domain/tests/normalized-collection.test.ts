import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createPlayer, NormalizedCollection } from '../src/index.js';
import { IDS, playerInput, unwrap } from '../../../tests/fixtures/domain.js';

describe('NormalizedCollection', () => {
  it('copia os registros e preserva a identidade quando a entrada é alterada', () => {
    const entity = { id: String(IDS.player), name: 'Caio' };
    const collection = unwrap(NormalizedCollection.create([entity]));
    entity.id = IDS.secondPlayer;
    entity.name = 'Alterado';
    expect(collection.ids).toEqual([IDS.player]);
    expect(collection.findById(IDS.player)).toEqual({ id: IDS.player, name: 'Caio' });
    expect(Object.isFrozen(collection.findById(IDS.player))).toBe(true);
    expect(collection.findById(IDS.secondPlayer)).toBeUndefined();
  });
  it('cria coleções vazias e consulta sem acessar propriedades herdadas', () => {
    const collection = unwrap(NormalizedCollection.create([]));
    expect(collection.ids).toEqual([]);
    expect(collection.findById('toString')).toBeUndefined();
    expect(collection.findById('__proto__')).toBeUndefined();
    expect(collection.remove(IDS.player)).toMatchObject({
      ok: false,
      error: { code: 'ENTITY_NOT_FOUND' },
    });
  });

  it('adiciona, substitui e remove sem modificar versões anteriores', () => {
    const first = unwrap(createPlayer(playerInput()));
    const second = unwrap(createPlayer(playerInput({ id: IDS.secondPlayer })));
    const collection = unwrap(NormalizedCollection.create([first]));
    const added = unwrap(collection.add(second));
    const replacement = unwrap(createPlayer(playerInput({ name: 'Novo nome' })));
    const replaced = unwrap(added.replace(replacement));
    const removed = unwrap(replaced.remove(first.id));
    expect(collection.ids).toEqual([first.id]);
    expect(added.ids).toEqual([first.id, second.id]);
    expect(replaced.findById(first.id)?.name).toBe('Novo nome');
    expect(added.findById(first.id)?.name).toBe(first.name);
    expect(removed.ids).toEqual([second.id]);
    expect(Object.isFrozen(collection)).toBe(true);
    expect(Object.isFrozen(collection.ids)).toBe(true);
    expect(Object.isFrozen(collection.byId)).toBe(true);
  });

  it('rejeita identificadores inválidos, repetidos e substituições ausentes', () => {
    expect(NormalizedCollection.create([{ id: '__proto__' }]).ok).toBe(false);
    expect(NormalizedCollection.create([{ id: IDS.player }, { id: IDS.player }])).toMatchObject({
      ok: false,
      error: { code: 'DUPLICATE_ENTITY' },
    });
    const collection = unwrap(
      NormalizedCollection.create<{ readonly id: string }>([{ id: IDS.player }]),
    );
    expect(collection.add({ id: IDS.player }).ok).toBe(false);
    expect(collection.replace({ id: IDS.secondPlayer })).toMatchObject({
      ok: false,
      error: { code: 'ENTITY_NOT_FOUND' },
    });
  });

  it('mantém ids e byId em correspondência para listas aleatórias', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.uuid(), { maxLength: 50 }), (ids) => {
        const collection = unwrap(
          NormalizedCollection.create(ids.map((id) => Object.freeze({ id }))),
        );
        expect(collection.ids).toEqual(ids);
        expect(Object.keys(collection.byId)).toEqual(ids);
        for (const id of ids) {
          expect(collection.findById(id)?.id).toBe(id);
        }
      }),
    );
  });
});
