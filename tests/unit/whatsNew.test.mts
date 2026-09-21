import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPendingNews, type Novedad } from '../../src/lib/whatsNew.ts';

const NOW = new Date('2026-09-21T18:00:00Z');
const base: Novedad = {
  id: 'squads-v2',
  pantalla: 'Squads',
  titulo: 'Nuevo',
  cuerpo: 'Texto',
  publicada_en: '2026-09-20T00:00:00Z',
  vigente_hasta: null,
  activa: true,
};

test('muestra un aviso activo y publicado en su pantalla', () => {
  assert.equal(pickPendingNews([base], [], 'Squads', NOW)?.id, 'squads-v2');
});

test('no lo muestra en otra pantalla', () => {
  assert.equal(pickPendingNews([base], [], 'Festivals', NOW), null);
});

test('deja de mostrarse cuando el usuario ya lo vio', () => {
  assert.equal(pickPendingNews([base], ['squads-v2'], 'Squads', NOW), null);
  assert.equal(pickPendingNews([base], new Set(['squads-v2']), 'Squads', NOW), null);
});

test('no muestra avisos pausados, futuros ni vencidos', () => {
  assert.equal(pickPendingNews([{ ...base, activa: false }], [], 'Squads', NOW), null);
  assert.equal(pickPendingNews([{ ...base, publicada_en: '2026-09-22T00:00:00Z' }], [], 'Squads', NOW), null);
  assert.equal(pickPendingNews([{ ...base, vigente_hasta: '2026-09-21T17:59:59Z' }], [], 'Squads', NOW), null);
});

test('un aviso con vigencia futura sí se muestra', () => {
  assert.equal(pickPendingNews([{ ...base, vigente_hasta: '2026-09-30T00:00:00Z' }], [], 'Squads', NOW)?.id, 'squads-v2');
});

test('con varios pendientes muestra solo uno: el más reciente', () => {
  const a = { ...base, id: 'a', publicada_en: '2026-09-01T00:00:00Z' };
  const b = { ...base, id: 'b', publicada_en: '2026-09-15T00:00:00Z' };
  const c = { ...base, id: 'c', publicada_en: '2026-09-10T00:00:00Z' };
  assert.equal(pickPendingNews([a, b, c], [], 'Squads', NOW)?.id, 'b');
  assert.equal(pickPendingNews([a, b, c], ['b'], 'Squads', NOW)?.id, 'c', 'al cerrar el más nuevo sigue el siguiente');
});

test('sin avisos devuelve null', () => {
  assert.equal(pickPendingNews([], [], 'Squads', NOW), null);
});
