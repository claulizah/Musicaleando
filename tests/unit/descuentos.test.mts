import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  descuentoBadge,
  descuentoVigente,
  descuentoVigenciaLabel,
  formatDiaCorto,
  mexicoToday,
  preventaVigente,
  tienePromo,
  type PromoFields,
} from '../../src/lib/descuentos.ts';
import { validateDescuento } from '../../admin/src/lib/descuentosForm.ts';

const HOY = '2026-09-25';
const base: PromoFields = { fecha_fin: '2026-11-20', estado_evento: 'activo' };

test('mexicoToday usa la fecha de México (UTC-6), no la de UTC', () => {
  assert.equal(mexicoToday(new Date('2026-09-25T05:59:00Z')), '2026-09-24');
  assert.equal(mexicoToday(new Date('2026-09-25T06:00:00Z')), '2026-09-25');
  assert.equal(mexicoToday(new Date('2026-09-26T03:00:00Z')), '2026-09-25', 'a las 9 p.m. del 25 en México todavía es 25');
});

test('formatDiaCorto no depende de Intl', () => {
  assert.equal(formatDiaCorto('2026-09-05'), '5 sep');
  assert.equal(formatDiaCorto('2026-12-31'), '31 dic');
});

test('descuento: necesita tipo válido y detalle', () => {
  assert.equal(descuentoVigente({ ...base, tipo_descuento: '2x1', descuento_detalle: 'Jueves con Banamex' }, HOY), true);
  assert.equal(descuentoVigente({ ...base, tipo_descuento: '2x1', descuento_detalle: '  ' }, HOY), false);
  assert.equal(descuentoVigente({ ...base, tipo_descuento: '2x1', descuento_detalle: null }, HOY), false);
  assert.equal(descuentoVigente({ ...base, tipo_descuento: 'raro', descuento_detalle: 'x' }, HOY), false);
  assert.equal(descuentoVigente({ ...base }, HOY), false);
});

test('descuento: deja de mostrarse al vencer su vigencia (el último día todavía cuenta)', () => {
  const f = { ...base, tipo_descuento: 'porcentaje', descuento_detalle: '20% con Citi', descuento_vigente_hasta: '2026-09-25' };
  assert.equal(descuentoVigente(f, '2026-09-25'), true);
  assert.equal(descuentoVigente(f, '2026-09-26'), false);
  assert.equal(descuentoVigente({ ...f, descuento_vigente_hasta: null }, '2027-01-01'), false, 'sin vigencia, igual se apaga al pasar el evento');
});

test('descuento y preventa se apagan si el evento ya pasó o está archivado', () => {
  const promo = { tipo_descuento: '2x1', descuento_detalle: 'x', preventa_inicio: '2026-09-01', preventa_detalle: 'x' };
  assert.equal(tienePromo({ ...base, ...promo }, HOY), true);
  assert.equal(tienePromo({ ...base, ...promo, fecha_fin: '2026-09-24' }, HOY), false);
  assert.equal(tienePromo({ ...base, ...promo, fecha_fin: '2026-09-25' }, HOY), true, 'el día del evento todavía cuenta');
  assert.equal(tienePromo({ ...base, ...promo, estado_evento: 'archivado' }, HOY), false);
});

test('preventa: próxima, activa y vencida', () => {
  assert.deepEqual(preventaVigente({ ...base, preventa_inicio: '2026-10-01' }, HOY), {
    estado: 'proxima',
    label: 'Preventa desde 1 oct',
  });
  assert.deepEqual(preventaVigente({ ...base, preventa_inicio: '2026-09-20', preventa_fin: '2026-09-30' }, HOY), {
    estado: 'activa',
    label: 'Preventa hasta 30 sep',
  });
  assert.deepEqual(preventaVigente({ ...base, preventa_inicio: '2026-09-20' }, HOY), { estado: 'activa', label: 'Preventa' });
  assert.equal(preventaVigente({ ...base, preventa_inicio: '2026-09-01', preventa_fin: '2026-09-24' }, HOY), null);
  assert.equal(preventaVigente({ ...base }, HOY), null);
  assert.deepEqual(preventaVigente({ ...base, preventa_detalle: 'Con tarjeta Banamex' }, HOY), { estado: 'activa', label: 'Preventa' });
});

test('etiquetas: tipo de descuento y vigencia', () => {
  const f = { ...base, tipo_descuento: '2x1', descuento_detalle: 'Jueves', descuento_vigente_hasta: '2026-09-30' };
  assert.equal(descuentoBadge(f, HOY), '2x1');
  assert.equal(descuentoBadge({ ...f, tipo_descuento: 'precio_especial' }, HOY), 'Precio especial');
  assert.equal(descuentoBadge(f, '2026-10-01'), null);
  assert.equal(descuentoVigenciaLabel(f), 'Hasta 30 sep');
  assert.equal(descuentoVigenciaLabel({ ...f, descuento_vigente_hasta: null }), null);
});

const vacio = { tipo: '', detalle: '', vigenteHasta: '', preventaInicio: '', preventaFin: '', preventaDetalle: '' };

test('admin: sin tipo se borra el bloque de descuento; la preventa se conserva', () => {
  const r = validateDescuento({ ...vacio, detalle: 'sobra', vigenteHasta: '2026-09-30', preventaInicio: '2026-10-01' });
  assert.ok('values' in r);
  if ('values' in r) {
    assert.equal(r.values.tipo_descuento, null);
    assert.equal(r.values.descuento_detalle, null);
    assert.equal(r.values.descuento_vigente_hasta, null);
    assert.equal(r.values.preventa_inicio, '2026-10-01');
  }
});

test('admin: con tipo el detalle es obligatorio', () => {
  const r = validateDescuento({ ...vacio, tipo: '2x1' });
  assert.ok('error' in r && r.error.includes('detalle'));
  const ok = validateDescuento({ ...vacio, tipo: '2x1', detalle: '  Jueves con Banamex ', vigenteHasta: '2026-09-30' });
  assert.ok('values' in ok);
  if ('values' in ok) assert.deepEqual([ok.values.descuento_detalle, ok.values.descuento_vigente_hasta], ['Jueves con Banamex', '2026-09-30']);
});

test('admin: rechaza tipos raros, fechas imposibles y fin antes de inicio', () => {
  assert.ok('error' in validateDescuento({ ...vacio, tipo: 'gratis', detalle: 'x' }));
  assert.ok('error' in validateDescuento({ ...vacio, tipo: '2x1', detalle: 'x', vigenteHasta: '2026-02-30' }));
  assert.ok('error' in validateDescuento({ ...vacio, preventaInicio: '2026-10-05', preventaFin: '2026-10-01' }));
  assert.ok('error' in validateDescuento({ ...vacio, preventaFin: '2026-10-05' }), 'una preventa solo con fin no sirve');
  assert.ok('error' in validateDescuento({ ...vacio, tipo: '2x1', detalle: 'x'.repeat(201) }));
});

test('la copia de la app y la del admin tienen exactamente la misma lógica', () => {
  const code = (p: string) =>
    readFileSync(new URL(p, import.meta.url), 'utf8')
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
  assert.equal(code('../../src/lib/descuentos.ts'), code('../../admin/src/lib/descuentos.ts'));
});
