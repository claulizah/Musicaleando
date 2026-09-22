import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, csvFilename } from '../../admin/src/lib/csvExport.ts';

test('toCsv: encabezados + filas, separadas por coma y CRLF (RFC 4180)', () => {
  const csv = toCsv(['nombre', 'ciudad'], [['Mago de Oz', 'Puebla'], ['Alan Parsons', 'CDMX']]);
  assert.equal(csv, 'nombre,ciudad\r\nMago de Oz,Puebla\r\nAlan Parsons,CDMX');
});

test('toCsv: un campo con coma, comilla o salto de línea se envuelve en comillas (y las comillas internas se doblan)', () => {
  assert.equal(toCsv(['a'], [['uno, dos']]), 'a\r\n"uno, dos"');
  assert.equal(toCsv(['a'], [['dijo "hola"']]), 'a\r\n"dijo ""hola"""');
  assert.equal(toCsv(['a'], [['línea1\nlínea2']]), 'a\r\n"línea1\nlínea2"');
});

test('toCsv: un campo sin caracteres especiales no se toca', () => {
  assert.equal(toCsv(['a'], [['Simple']]), 'a\r\nSimple');
});

test('csvFilename: incluye el prefijo y la fecha de hoy en formato AAAA-MM-DD', () => {
  const name = csvFilename('catalogo');
  assert.match(name, /^musicaleando-catalogo-\d{4}-\d{2}-\d{2}\.csv$/);
  const today = new Date();
  const expected = `musicaleando-catalogo-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.csv`;
  assert.equal(name, expected);
});
