import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLdEvents,
  findPossibleDuplicate,
  normalizeEvent,
  performerName,
  sourceIdFromUrl,
  titleCaseIfShouting,
} from '../../supabase/functions/eticket-sync/normalize.ts';

test('titleCaseIfShouting: solo actúa si la cadena viene TODA en mayúsculas', () => {
  assert.equal(titleCaseIfShouting('MIJARES SINFÓNICO'), 'Mijares Sinfónico');
  assert.equal(titleCaseIfShouting('NACH'), 'Nach');
  assert.equal(titleCaseIfShouting('SIDDHARTHA'), 'Siddhartha');
});

test('titleCaseIfShouting: conectores en español quedan en minúscula salvo al inicio', () => {
  assert.equal(titleCaseIfShouting('EL HARAGÁN Y CÍA'), 'El Haragán y Cía');
  assert.equal(
    titleCaseIfShouting('HOMENAJE SINFÓNICO AL ÍDOLO DE JUAREZ'),
    'Homenaje Sinfónico al Ídolo de Juarez',
  );
});

test('titleCaseIfShouting: no toca nada que ya venga en mayúsculas y minúsculas mezcladas', () => {
  // Un nombre artístico real estilizado (o ya bien capitalizado) se deja intacto — la
  // fuente NO viene gritando, así que no hay señal para re-castear.
  assert.equal(titleCaseIfShouting('Álvaro Díaz'), 'Álvaro Díaz');
  assert.equal(titleCaseIfShouting('deadmau5'), 'deadmau5');
  assert.equal(titleCaseIfShouting('YURIDIA - Las Cartas Sobre la Mesa'), 'YURIDIA - Las Cartas Sobre la Mesa');
});

test('titleCaseIfShouting: conserva guiones internos capitalizando cada tramo', () => {
  assert.equal(titleCaseIfShouting('SUB-CERO'), 'Sub-Cero');
});

test('titleCaseIfShouting: colapsa espacios y no truena con vacío', () => {
  assert.equal(titleCaseIfShouting('  PUEBLA  '), 'Puebla');
  assert.equal(titleCaseIfShouting(''), '');
});

test('performerName: ignora el performer placeholder del evento de prueba de eticket', () => {
  assert.equal(performerName({ name: 'Artista de prueba' }), null);
  assert.equal(performerName({ name: 'artista DE PRUEBA' }), null);
  assert.equal(performerName([{ name: 'Álvaro Díaz' }]), 'Álvaro Díaz');
  assert.equal(performerName(undefined), null);
});

test('sourceIdFromUrl: extrae el idevento del link de eticket', () => {
  assert.equal(sourceIdFromUrl('https://www.eticket.mx/masinformacion.aspx?idevento=35835'), '35835');
  assert.equal(sourceIdFromUrl('https://www.eticket.mx/masinformacion.aspx?otro=1'), null);
  assert.equal(sourceIdFromUrl(undefined), null);
});

const ldPage = (events: object[]) => `
<html><body>
<script type="application/ld+json">${JSON.stringify(events)}</script>
</body></html>`;

test('extractLdEvents: parsea bloques JSON-LD y filtra solo @type Event', () => {
  const html = ldPage([
    { '@context': 'https://schema.org', '@type': 'Event', name: 'A' },
    { '@context': 'https://schema.org', '@type': 'Organization', name: 'eticket' },
  ]);
  const events = extractLdEvents(html);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, 'A');
});

test('extractLdEvents: un bloque malformado no tumba el resto', () => {
  const html = `
    <script type="application/ld+json">{ esto no es json </script>
    ${ldPage([{ '@type': 'Event', name: 'B' }])}
  `;
  const events = extractLdEvents(html);
  assert.deepEqual(events.map((e) => e.name), ['B']);
});

const baseEvent = {
  '@type': 'Event',
  name: 'ÁLVARO DÍAZ',
  url: 'https://www.eticket.mx/masinformacion.aspx?idevento=35835',
  startDate: '2026-09-22T21:00:00-06:00',
  endDate: '2026-09-22',
  eventStatus: 'https://schema.org/EventScheduled',
  location: { name: 'AUDITORIO METROPOLITANO', address: { addressLocality: 'PUEBLA', addressRegion: 'PUEBLA' } },
  performer: { name: 'ÁLVARO DÍAZ' },
  offers: [{ price: 2225, priceCurrency: 'MXN' }, { price: 1720, priceCurrency: 'MXN' }],
};

test('normalizeEvent: arma el candidato con nombre/venue/ciudad normalizados y precios', () => {
  const n = normalizeEvent(baseEvent);
  assert.equal(n.source, 'eticket');
  assert.equal(n.source_id, '35835');
  assert.equal(n.nombre, 'Álvaro Díaz');
  assert.equal(n.venue, 'Auditorio Metropolitano');
  assert.equal(n.ciudad, 'Puebla');
  assert.equal(n.fecha_inicio, '2026-09-22');
  assert.equal(n.fecha_fin, '2026-09-22');
  assert.deepEqual([n.price_min, n.price_max, n.price_currency], [1720, 2225, 'MXN']);
  assert.deepEqual(n.lineup, ['ÁLVARO DÍAZ']); // el nombre del performer se guarda tal cual lo da la fuente
  assert.equal(n.completo, true);
  assert.equal(n.cancelado_o_pospuesto, false);
  assert.equal(n.esEventoDePrueba, false);
});

test('normalizeEvent: detecta cancelado y pospuesto', () => {
  assert.equal(normalizeEvent({ ...baseEvent, eventStatus: 'https://schema.org/EventCancelled' }).cancelado_o_pospuesto, true);
  assert.equal(normalizeEvent({ ...baseEvent, eventStatus: 'https://schema.org/EventPostponed' }).cancelado_o_pospuesto, true);
  assert.equal(normalizeEvent(baseEvent).cancelado_o_pospuesto, false);
});

test('normalizeEvent: sin ciudad, fecha o link no se considera completo', () => {
  assert.equal(normalizeEvent({ ...baseEvent, location: undefined }).completo, false);
  assert.equal(normalizeEvent({ ...baseEvent, startDate: undefined }).completo, false);
  assert.equal(normalizeEvent({ ...baseEvent, url: undefined }).completo, false);
});

test('normalizeEvent: el evento de prueba de eticket se marca para descartar', () => {
  const prueba = {
    ...baseEvent,
    name: 'EVENTO ARTISTA FAVORITO 2025',
    performer: { name: 'Artista de prueba' },
    offers: [{ price: 0.01, priceCurrency: 'MXN' }],
  };
  assert.equal(normalizeEvent(prueba).esEventoDePrueba, true);
  assert.deepEqual(normalizeEvent(prueba).lineup, []);
});

test('la página de eticket.mx se decodifica como ISO-8859-15, no UTF-8 (Content-Type real del sitio)', () => {
  // Bytes reales tomados de la respuesta de eticket.mx para "ÁLVARO DÍAZ".
  // Con .text() (que decodifica siempre como UTF-8, sin ver el charset del
  // header) 0xC1 se corrompe en U+FFFD; con TextDecoder('iso-8859-15') decodifica bien.
  const bytes = new Uint8Array([0xc1, 0x4c, 0x56, 0x41, 0x52, 0x4f, 0x20, 0x44, 0xcd, 0x41, 0x5a]);
  const decoded = new TextDecoder('iso-8859-15').decode(bytes);
  assert.equal(decoded, 'ÁLVARO DÍAZ');
  assert.equal(titleCaseIfShouting(decoded), 'Álvaro Díaz');
});

test('findPossibleDuplicate: nombre+fecha+ciudad contra el catálogo (activo o archivado)', () => {
  const festivals = [{ id: 'f1', nombre: 'Álvaro Díaz - Omakase', ciudad: 'Puebla', fecha_inicio: '2026-09-22' }];
  assert.equal(
    findPossibleDuplicate({ nombre: 'Álvaro Díaz', ciudad: 'Puebla', fecha_inicio: '2026-09-22' }, festivals),
    'f1',
  );
  assert.equal(
    findPossibleDuplicate({ nombre: 'Álvaro Díaz', ciudad: 'Mérida', fecha_inicio: '2026-09-22' }, festivals),
    null,
    'misma fecha pero otra ciudad: no es el mismo evento (gira con varias fechas)',
  );
  assert.equal(
    findPossibleDuplicate({ nombre: 'Otro Artista', ciudad: 'Puebla', fecha_inicio: '2026-09-22' }, festivals),
    null,
  );
});
