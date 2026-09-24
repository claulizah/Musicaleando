import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findPossibleDuplicate,
  localDateTime,
  normalizeEvent,
  parseEventList,
  timeZoneFor,
} from '../../supabase/functions/arema-sync/normalize.ts';

const julieta = {
  event_id: 18032,
  event_name: 'Julieta Venegas en Mérida',
  subdomain: null,
  category_id: 1,
  category_name: 'Concierto',
  date: 1790218800, // 2026-09-24T03:00:00Z
  venue_id: 698,
  venue_name: 'Auditorio Coca Cola La Isla',
  city: 'Mérida',
  state: 'Yucatán',
  poster: null,
};

test('hora real: el Unix de Julieta Venegas es 21:00 del 23 sep en Mérida (la sinopsis del evento dice "21:00 horas")', () => {
  assert.deepEqual(localDateTime(1790218800, 'America/Mexico_City'), { fecha: '2026-09-23', hora: '21:00' });
});

test('zona horaria: Arema codifica toda hora como hora del centro (verificado contra la hora escrita en cada evento)', () => {
  for (const [st, c] of [['Baja California', 'Tijuana'], ['Quintana Roo', 'Cancún'], ['Sonora', 'Hermosillo'], ['Nuevo León', 'Monterrey'], [null, null]] as const) {
    assert.equal(timeZoneFor(st, c), 'America/Mexico_City');
  }
  // Tijuana 21032: Unix 1790384400 = 01:00Z; el texto del evento dice 19:00 (hora del centro) del 25 sep.
  assert.deepEqual(localDateTime(1790384400, timeZoneFor('Baja California', 'Tijuana')), { fecha: '2026-09-25', hora: '19:00' });
});

test('el mismo instante cae en el día correcto (concierto a las 22:30 hora del centro)', () => {
  const unix = Date.UTC(2026, 9, 1, 4, 30) / 1000; // 04:30Z del 1 oct
  assert.equal(localDateTime(unix, 'America/Mexico_City').fecha, '2026-09-30');
  assert.equal(localDateTime(unix, 'America/Mexico_City').hora, '22:30');
});

test('normalizeEvent: mapea campos, arma el link solo con el ID y no inventa póster', () => {
  const n = normalizeEvent(julieta);
  assert.equal(n.source, 'arema');
  assert.equal(n.source_id, '18032');
  assert.equal(n.nombre, 'Julieta Venegas en Mérida');
  assert.equal(n.fecha_inicio, '2026-09-23');
  assert.equal(n.link_boletos, 'https://arema.mx/e/18032');
  assert.equal(n.image_url, null);
  assert.equal(n.venue, 'Auditorio Coca Cola La Isla');
  assert.equal(n.completo, true);
  assert.equal((n.raw_payload as { hora_local: string }).hora_local, '21:00');
  assert.deepEqual(n.lineup, []);
});

test('normalizeEvent: usa el póster solo si la API lo trae, y quita comillas tipográficas del nombre', () => {
  const n = normalizeEvent({ ...julieta, event_name: '“Hocico en Monterrey”', poster: 'https://cdn.arema.dev/x.webp' });
  assert.equal(n.nombre, 'Hocico en Monterrey');
  assert.equal(n.image_url, 'https://cdn.arema.dev/x.webp');
});

test('parseEventList: acepta la forma real y falla en voz alta si cambia', () => {
  assert.equal(parseEventList({ error: false, data: { events: [julieta] } }).length, 1);
  assert.throws(() => parseEventList({ error: true }), /error=true/);
  assert.throws(() => parseEventList({ error: false, data: {} }), /falta data\.events/);
  assert.throws(() => parseEventList({ error: false, data: { events: [] } }), /0 eventos/);
  const { date: _d, ...sinFecha } = julieta;
  assert.throws(() => parseEventList({ error: false, data: { events: [sinFecha] } }), /"date"/);
});

test('duplicados: contra festivales y contra candidatos con la misma regla (nombre contenido + ±1 día + ciudad)', () => {
  const pool = [
    { id: 'f1', nombre: 'Julieta Venegas', ciudad: 'Mérida', fecha_inicio: '2026-09-23' },
    { id: 'f2', nombre: 'Otro Artista', ciudad: 'Mérida', fecha_inicio: '2026-09-23' },
  ];
  const ev = { nombre: 'Julieta Venegas en Mérida', ciudad: 'Mérida', fecha_inicio: '2026-09-23' };
  assert.equal(findPossibleDuplicate(ev, pool), 'f1');
  assert.equal(findPossibleDuplicate({ ...ev, fecha_inicio: '2026-09-25' }, pool), null); // >1 día
  assert.equal(findPossibleDuplicate({ ...ev, ciudad: 'Monterrey' }, pool), null); // otra ciudad
});
