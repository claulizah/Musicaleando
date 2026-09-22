import test from 'node:test';
import assert from 'node:assert/strict';
import { groupFollowersByUser, buildPushBody } from '../../admin/src/lib/pushNotifications.ts';

const artistNameById = new Map([
  ['a1', 'Bad Bunny'],
  ['a2', 'Karol G'],
  ['a3', 'Rauw Alejandro'],
]);

test('agrupa por usuario los artistas seguidos que SÍ están en este line-up', () => {
  const grouped = groupFollowersByUser(
    ['a1', 'a2'],
    [
      { user_id: 'u1', artist_id: 'a1' },
      { user_id: 'u2', artist_id: 'a2' },
    ],
    artistNameById,
  );
  assert.deepEqual(grouped.get('u1'), ['Bad Bunny']);
  assert.deepEqual(grouped.get('u2'), ['Karol G']);
  assert.equal(grouped.size, 2);
});

test('un usuario que sigue a DOS artistas del mismo cartel queda en una sola entrada (un solo push, no uno por artista)', () => {
  const grouped = groupFollowersByUser(
    ['a1', 'a2'],
    [
      { user_id: 'u1', artist_id: 'a1' },
      { user_id: 'u1', artist_id: 'a2' },
    ],
    artistNameById,
  );
  assert.equal(grouped.size, 1);
  assert.deepEqual(grouped.get('u1'), ['Bad Bunny', 'Karol G']);
});

test('ignora follows de artistas que NO están en el line-up de este evento', () => {
  const grouped = groupFollowersByUser(
    ['a1'],
    [{ user_id: 'u1', artist_id: 'a3' }], // sigue a a3, pero a3 no toca en este evento
    artistNameById,
  );
  assert.equal(grouped.size, 0);
});

test('sin follows, no truena y devuelve vacío', () => {
  const grouped = groupFollowersByUser(['a1'], [], artistNameById);
  assert.equal(grouped.size, 0);
});

test('buildPushBody: un solo artista', () => {
  assert.equal(buildPushBody(['Bad Bunny']), 'Bad Bunny');
});

test('buildPushBody: dos artistas', () => {
  assert.equal(buildPushBody(['Bad Bunny', 'Karol G']), 'Bad Bunny y Karol G');
});

test('buildPushBody: tres o más artistas se resume ("y N más")', () => {
  assert.equal(buildPushBody(['Bad Bunny', 'Karol G', 'Rauw Alejandro']), 'Bad Bunny y 2 más');
});
