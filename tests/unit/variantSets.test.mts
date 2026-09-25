import test from 'node:test';
import assert from 'node:assert/strict';
import { sameIdSet } from '../../admin/src/lib/variantSets.ts';

test('mismo conjunto de artistas, en cualquier orden y con repetidos -> variante', () => {
  assert.equal(sameIdSet(['a', 'b'], ['b', 'a']), true);
  assert.equal(sameIdSet(['a', 'a', 'b'], ['b', 'a']), true);
});
test('conjuntos distintos (día 1 vs abono con más artistas) NO son variantes', () => {
  assert.equal(sameIdSet(['a', 'b'], ['a', 'b', 'c']), false);
  assert.equal(sameIdSet(['a', 'b'], ['a', 'c']), false);
});
test('conjuntos vacíos nunca coinciden (sin artistas no hay base para decir que es el mismo evento)', () => {
  assert.equal(sameIdSet([], []), false);
  assert.equal(sameIdSet([], ['a']), false);
});
