import test from 'node:test';
import assert from 'node:assert/strict';
import { presalesToFields } from '../../admin/src/lib/tmPresales.ts';

const wave = {
  sales: {
    public: { startDateTime: '2026-05-21T16:00:00Z' },
    presales: [
      { name: 'Preventa Banamex', startDateTime: '2026-05-20T17:00:00Z', endDateTime: '2026-05-21T05:59:00Z' },
      { name: 'Venta Fans', startDateTime: '2026-05-20T16:00:00Z', endDateTime: '2026-05-21T04:00:00Z' },
      { name: 'Venta General Paquetes VIP', startDateTime: '2026-05-21T16:00:00Z', endDateTime: '2026-09-16T02:15:00Z' },
    ],
  },
};

test('varias preventas: inicio más temprano, fin más tardío, nombres concatenados, sin la venta general de paquetes VIP', () => {
  assert.deepEqual(presalesToFields(wave), {
    preventa_inicio: '2026-05-20',
    preventa_fin: '2026-05-20', // 05:59Z del 21 = 23:59 del 20 en México
    preventa_detalle: 'Preventa Banamex, Venta Fans', // mismo día de inicio: orden alfabético
  });
});

test('las fechas son días de México, no de UTC', () => {
  const r = presalesToFields({
    sales: { public: { startDateTime: '2026-06-01T16:00:00Z' }, presales: [{ name: 'Preventa X', startDateTime: '2026-05-25T03:00:00Z', endDateTime: '2026-05-30T05:59:00Z' }] },
  });
  assert.equal(r?.preventa_inicio, '2026-05-24'); // 03:00Z = 21:00 del 24 en México
  assert.equal(r?.preventa_fin, '2026-05-29');
});

test('ventana con varias preventas de días distintos', () => {
  const r = presalesToFields({
    sales: {
      public: { startDateTime: '2026-06-10T16:00:00Z' },
      presales: [
        { name: 'Preventa Banamex', startDateTime: '2026-06-02T16:00:00Z', endDateTime: '2026-06-04T05:59:00Z' },
        { name: 'Venta anticipada Spotify', startDateTime: '2026-06-01T16:00:00Z', endDateTime: '2026-06-09T05:59:00Z' },
      ],
    },
  });
  assert.deepEqual(r, { preventa_inicio: '2026-06-01', preventa_fin: '2026-06-08', preventa_detalle: 'Venta anticipada Spotify, Preventa Banamex' });
});

test('sin presales, vacío, sin nombre o con fechas inválidas -> null (no se inventa nada)', () => {
  assert.equal(presalesToFields({}), null);
  assert.equal(presalesToFields({ sales: {} }), null);
  assert.equal(presalesToFields({ sales: { presales: [] } }), null);
  assert.equal(presalesToFields({ sales: { presales: [{ name: '', startDateTime: '2026-01-01T00:00:00Z', endDateTime: '2026-01-02T00:00:00Z' }] } }), null);
  assert.equal(presalesToFields({ sales: { presales: [{ name: 'X', startDateTime: 'nada', endDateTime: 'nada' }] } }), null);
  assert.equal(presalesToFields(null), null);
});

test('solo una entrada "venta general" (abre con la venta pública) no cuenta como preventa', () => {
  assert.equal(
    presalesToFields({
      sales: { public: { startDateTime: '2026-05-21T16:00:00Z' }, presales: [{ name: 'Venta General Paquetes VIP', startDateTime: '2026-05-21T16:00:00Z', endDateTime: '2026-09-16T02:15:00Z' }] },
    }),
    null,
  );
});

test('una entrada llamada "Venta General …" nunca es preventa, aunque abra antes de la venta pública', () => {
  const r = presalesToFields({
    sales: {
      public: { startDateTime: '2026-05-21T16:00:00Z' },
      presales: [
        { name: 'Preventa Banamex', startDateTime: '2026-05-20T17:00:00Z', endDateTime: '2026-05-21T05:59:00Z' },
        { name: 'Venta General 1', startDateTime: '2026-05-20T18:00:00Z', endDateTime: '2027-02-15T02:00:00Z' },
      ],
    },
  });
  assert.deepEqual(r, { preventa_inicio: '2026-05-20', preventa_fin: '2026-05-20', preventa_detalle: 'Preventa Banamex' });
});

test('sin inicio de venta general se usan todas las entradas', () => {
  const r = presalesToFields({ sales: { presales: [{ name: 'Preventa A', startDateTime: '2026-05-01T16:00:00Z', endDateTime: '2026-05-03T16:00:00Z' }] } });
  assert.equal(r?.preventa_detalle, 'Preventa A');
});
