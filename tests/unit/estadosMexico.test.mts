import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTADOS_MEXICO, normalizeEstado } from '../../src/lib/estadosMexico.ts';

test('la lista tiene los 32 estados, sin repetidos', () => {
  assert.equal(ESTADOS_MEXICO.length, 32);
  assert.equal(new Set(ESTADOS_MEXICO).size, 32);
});

test('normalizeEstado acepta solo estados de la lista (con espacios sobrantes)', () => {
  assert.equal(normalizeEstado('Jalisco'), 'Jalisco');
  assert.equal(normalizeEstado('  Nuevo León '), 'Nuevo León');
  assert.equal(normalizeEstado('Ciudad de México'), 'Ciudad de México');
});

test('normalizeEstado rechaza texto libre, vacío o nulo (nunca se guarda basura)', () => {
  assert.equal(normalizeEstado('Guadalajara'), null);
  assert.equal(normalizeEstado('jalisco'), null);
  assert.equal(normalizeEstado(''), null);
  assert.equal(normalizeEstado(null), null);
  assert.equal(normalizeEstado(undefined), null);
});
