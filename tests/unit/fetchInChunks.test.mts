import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllByIds } from '../../src/lib/fetchInChunks.ts';

const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);

test('parte los ids en lotes de 40 (evita URLs demasiado largas) y junta todos los resultados', async () => {
  const seen: number[] = [];
  const { data, error } = await fetchAllByIds<string>(ids, async (chunk) => {
    seen.push(chunk.length);
    return { data: chunk, error: null };
  });
  assert.equal(error, null);
  assert.deepEqual(seen, [40, 40, 20]);
  assert.deepEqual(data, ids, 'conserva el orden original');
});

test('los lotes se piden en paralelo, no uno tras otro', async () => {
  let running = 0;
  let maxRunning = 0;
  await fetchAllByIds<string>(ids, async (chunk) => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((r) => setTimeout(r, 20));
    running--;
    return { data: chunk, error: null };
  });
  assert.equal(maxRunning, 3);
});

test('si un lote falla, se reporta el error', async () => {
  const boom = { message: 'boom', details: '', hint: '', code: '400', name: 'PostgrestError' };
  const { error } = await fetchAllByIds<string>(ids, async (chunk) =>
    chunk[0] === 'id-40' ? { data: null, error: boom } : { data: chunk, error: null },
  );
  assert.equal(error?.message, 'boom');
});

test('sin ids no hace ninguna consulta', async () => {
  let calls = 0;
  const { data, error } = await fetchAllByIds<string>([], async () => {
    calls++;
    return { data: [], error: null };
  });
  assert.deepEqual([data, error, calls], [[], null, 0]);
});
