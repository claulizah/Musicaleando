import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTIST_GENRES, genreLabel, sanitizeGenres } from '../../admin/src/lib/artistGenres.ts';

test('sanitizeGenres: solo ids de la lista, sin repetidos, en el orden de la lista', () => {
  assert.deepEqual(sanitizeGenres(['rock', 'pop', 'rock', 'inventado']), ['pop', 'rock']);
});
test('sanitizeGenres: vacío o inválido -> null', () => {
  assert.equal(sanitizeGenres([]), null);
  assert.equal(sanitizeGenres(['nada']), null);
  assert.equal(sanitizeGenres('rock'), null);
  assert.equal(sanitizeGenres(null), null);
});
test('la lista incluye las 15 del ticket + 3 agregadas, con ids únicos, y Otro al final', () => {
  const ids = ARTIST_GENRES.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 18);
  assert.equal(ids.at(-1), 'otro');
  assert.equal(genreLabel('regional_mexicano'), 'Regional Mexicano');
});
