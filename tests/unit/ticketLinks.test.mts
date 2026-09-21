import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTicketUrl, detectTicketPlatform } from '../../src/lib/ticketLinks.ts';

const TM = 'https://www.ticketmaster.com.mx/virus-ciudad-de-mexico-14-09-2026/event/3D0064BDEEEAB637?tm_link=a&b=1';
const TEMPLATE = 'https://ticketmaster.evyy.net/c/000000/000000/000000?u={url}';

test('detecta la plataforma de destino por dominio', () => {
  assert.equal(detectTicketPlatform(TM), 'ticketmaster');
  assert.equal(detectTicketPlatform('https://ticketmaster.com/event/1'), 'ticketmaster');
  assert.equal(detectTicketPlatform('https://on.fgtix.com/x'), 'frontgate');
  assert.equal(detectTicketPlatform('https://www.eticket.mx/evento/1'), 'eticket');
  assert.equal(detectTicketPlatform('https://www.superboletos.com/landing-evento/abc'), 'superboletos');
  assert.equal(detectTicketPlatform('https://ejemplo.com/boletos'), 'otro');
  assert.equal(detectTicketPlatform('no-es-una-url'), 'otro');
});

test('un dominio que solo "contiene" ticketmaster no cuenta como Ticketmaster', () => {
  assert.equal(detectTicketPlatform('https://ticketmaster.com.mx.evil.example/x'), 'otro');
  assert.equal(detectTicketPlatform('https://notticketmaster.com/x'), 'otro');
});

test('sin plantilla el link se abre tal cual', () => {
  const r = buildTicketUrl(TM, null);
  assert.deepEqual(r, { url: TM, plataforma: 'ticketmaster', afiliado: false });
});

test('con plantilla, Ticketmaster queda envuelto y el link original se recupera intacto', () => {
  const r = buildTicketUrl(TM, TEMPLATE);
  assert.equal(r.afiliado, true);
  assert.equal(r.plataforma, 'ticketmaster');
  assert.ok(r.url.startsWith('https://ticketmaster.evyy.net/c/000000/000000/000000?u='));
  const u = new URL(r.url).searchParams.get('u');
  assert.equal(u, TM, 'el parámetro u debe decodificar al link original exacto, con sus propios ? y &');
});

test('el afiliado solo se aplica a Ticketmaster', () => {
  for (const link of ['https://www.eticket.mx/e/1', 'https://on.fgtix.com/x', 'https://www.superboletos.com/landing-evento/abc']) {
    const r = buildTicketUrl(link, TEMPLATE);
    assert.equal(r.afiliado, false);
    assert.equal(r.url, link);
  }
});

test('una plantilla inválida se ignora en vez de romper el botón de compra', () => {
  for (const bad of ['', '   ', 'https://x.net/c/1', 'http://x.net/?u={url}', 'ftp://x.net/?u={url}', '{url}']) {
    const r = buildTicketUrl(TM, bad);
    assert.equal(r.afiliado, false, `plantilla "${bad}" no debería aplicarse`);
    assert.equal(r.url, TM);
  }
});

test('un link que ya viene envuelto no se envuelve dos veces', () => {
  const wrapped = 'https://ticketmaster.evyy.net/c/1/2/3?u=https%3A%2F%2Fexample.com';
  assert.equal(buildTicketUrl(wrapped, TEMPLATE).afiliado, false);
});

test('el espacio alrededor de la plantilla no la estropea', () => {
  const r = buildTicketUrl(TM, `  ${TEMPLATE}  `);
  assert.equal(r.afiliado, true);
});
