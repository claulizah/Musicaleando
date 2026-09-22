import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows } from '../../admin/src/lib/fetchAllRows.ts';

test('trae todas las páginas hasta que una vuelve incompleta', async () => {
  const pages = [
    Array.from({ length: 1000 }, (_, i) => i),
    Array.from({ length: 1000 }, (_, i) => 1000 + i),
    Array.from({ length: 146 }, (_, i) => 2000 + i),
  ];
  let calls = 0;
  const { data, error } = await fetchAllRows<number>((from, to) => {
    calls++;
    const page = pages[from / 1000];
    return Promise.resolve({ data: page ?? [], error: null });
  });
  assert.equal(error, null);
  assert.equal(data.length, 2146);
  assert.equal(calls, 3, 'se detiene en cuanto una página vuelve con menos de 1000 filas, sin pedir una de más');
});

test('con menos de una página completa, una sola llamada basta', async () => {
  let calls = 0;
  const { data } = await fetchAllRows<number>((from, to) => {
    calls++;
    return Promise.resolve({ data: [1, 2, 3], error: null });
  });
  assert.deepEqual(data, [1, 2, 3]);
  assert.equal(calls, 1);
});

test('sin filas, no truena y devuelve un arreglo vacío', async () => {
  const { data, error } = await fetchAllRows<number>(() => Promise.resolve({ data: [], error: null }));
  assert.deepEqual(data, []);
  assert.equal(error, null);
});

test('un error en cualquier página se reporta y detiene la paginación (no sigue pidiendo páginas de más)', async () => {
  let calls = 0;
  const { data, error } = await fetchAllRows<number>((from) => {
    calls++;
    if (from === 1000) return Promise.resolve({ data: null, error: { message: 'boom' } });
    return Promise.resolve({ data: Array.from({ length: 1000 }, (_, i) => from + i), error: null });
  });
  assert.equal(error, 'boom');
  assert.equal(data.length, 1000, 'conserva lo que ya se había traído antes del error');
  assert.equal(calls, 2);
});
