import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreview, isValidIsoDate, parseCsv, validateRow, type ExistingFestival } from '../../admin/src/lib/csvEventImport.ts';

const existing: ExistingFestival[] = [
  { id: '11111111-1111-1111-1111-111111111111', nombre: 'Corona Capital 2026', ciudad: 'Ciudad de México', fecha_inicio: '2026-11-20', estado_evento: 'activo' },
  { id: '22222222-2222-2222-2222-222222222222', nombre: 'Ana Torroja', ciudad: 'Ciudad de México', fecha_inicio: '2026-09-17', estado_evento: 'archivado' },
];
const HEADER = 'nombre,tipo_evento,ciudad,fecha_inicio,fecha_fin,link_boletos';

function preview(csv: string) {
  const r = buildPreview(csv, existing);
  assert.ok(r.ok, r.ok ? '' : r.error);
  return r.ok ? r : (undefined as never);
}

test('fechas: solo AAAA-MM-DD reales', () => {
  assert.equal(isValidIsoDate('2027-02-28'), true);
  assert.equal(isValidIsoDate('2027-02-30'), false);
  assert.equal(isValidIsoDate('31/12/2027'), false);
  assert.equal(isValidIsoDate('2027-13-01'), false);
  assert.equal(isValidIsoDate(''), false);
});

test('parseCsv: comillas, comas dentro del campo, comillas escapadas y saltos de línea', () => {
  const { records } = parseCsv('a,"b, c","d ""x"" e","línea1\nlínea2"\r\nf,g,h,i\r\n');
  assert.deepEqual(records, [['a', 'b, c', 'd "x" e', 'línea1\nlínea2'], ['f', 'g', 'h', 'i']]);
});

test('parseCsv: quita el BOM de Excel y detecta punto y coma', () => {
  const r = buildPreview('﻿nombre;tipo_evento;ciudad;fecha_inicio;fecha_fin;link_boletos\nEvento;concierto;Toluca;2027-08-01;;', existing);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.rows[0].status, 'ok');
});

test('fila válida: tipo vacío = concierto y fecha_fin vacía = mismo día', () => {
  const r = preview(`${HEADER}\nSin Tipo,,Puebla,2027-05-01,,`);
  assert.deepEqual(r.rows[0].row, { nombre: 'Sin Tipo', tipo: 'concierto', ciudad: 'Puebla', fecha_inicio: '2027-05-01', fecha_fin: '2027-05-01', link_boletos: null });
});

test('tipo_evento acepta mayúsculas y rechaza valores desconocidos', () => {
  const ok = validateRow({ nombre: 'X', tipo: 'FESTIVAL', ciudad: 'Y', fecha_inicio: '2027-01-01' });
  assert.ok('row' in ok && ok.row.tipo === 'festival');
  const bad = validateRow({ nombre: 'X', tipo: 'opera', ciudad: 'Y', fecha_inicio: '2027-01-01' });
  assert.ok('errors' in bad && bad.errors[0].includes('opera'));
});

test('cada tipo de error se reporta sin tumbar el resto de las filas', () => {
  const csv = [
    HEADER,
    'Bueno,concierto,Guadalajara,2027-03-05,2027-03-05,https://ejemplo.com/1',
    'Fecha Mala,concierto,Puebla,31/12/2027,,',
    'Fecha Imposible,concierto,Puebla,2027-02-30,,',
    ',concierto,Puebla,2027-05-01,,',
    'Sin Ciudad,concierto,,2027-05-01,,',
    'Fin Antes,concierto,Puebla,2027-05-10,2027-05-01,',
    'Link Malo,concierto,Puebla,2027-05-01,,ftp://x',
    'Otro Bueno,festival,Monterrey,2027-04-10,2027-04-12,',
  ].join('\n');
  const r = preview(csv);
  assert.deepEqual(
    r.rows.map((x) => x.status),
    ['ok', 'error', 'error', 'error', 'error', 'error', 'error', 'ok'],
  );
  assert.ok(r.rows[1].messages[0].includes('31/12/2027'));
});

test('detecta duplicados contra el catálogo activo y el archivado', () => {
  const r = preview([
    HEADER,
    'Corona Capital 2026,festival,Ciudad de México,2026-11-20,2026-11-22,',
    'Ana Torroja,concierto,Ciudad de México,2026-09-17,2026-09-17,',
  ].join('\n'));
  assert.equal(r.rows[0].status, 'duplicado_activo');
  assert.equal(r.rows[1].status, 'duplicado_archivado');
});

test('mismo nombre que un evento archivado pero otra fecha = re-anuncio (importable)', () => {
  const r = preview(`${HEADER}\nAna Torroja,concierto,Ciudad de México,2027-03-10,2027-03-10,`);
  assert.equal(r.rows[0].status, 'reanuncio_archivado');
});

test('detecta repetidos dentro del propio archivo', () => {
  const r = preview([HEADER, 'Nuevo,concierto,Puebla,2027-06-01,,', 'Nuevo,concierto,Puebla,2027-06-01,,'].join('\n'));
  assert.deepEqual(r.rows.map((x) => x.status), ['ok', 'duplicado_en_archivo']);
});

test('archivo sin encabezados: usa el orden del catálogo si la forma lo respalda', () => {
  const id = '33333333-3333-3333-3333-333333333333';
  const conId = buildPreview(`,,,,,,\n${id},Evento X,concierto,Puebla,2027-06-01,2027-06-01,https://ejemplo.com`, existing);
  assert.ok(conId.ok && conId.usedHeaderless && conId.rows[0].row?.nombre === 'Evento X');
  const sinId = buildPreview('Evento Y,concierto,Puebla,2027-06-01,2027-06-01,', existing);
  assert.ok(sinId.ok && sinId.usedHeaderless && sinId.rows[0].row?.nombre === 'Evento Y');
});

test('un id ya existente cuenta como duplicado', () => {
  const r = buildPreview('11111111-1111-1111-1111-111111111111,Otro nombre,concierto,Puebla,2027-06-01,2027-06-01,', existing);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.rows[0].status, 'duplicado_activo');
});

test('un archivo sin forma reconocible se rechaza con un mensaje claro', () => {
  const r = buildPreview('a,b,c\n1,2,3', existing);
  assert.equal(r.ok, false);
  const empty = buildPreview('', existing);
  assert.equal(empty.ok, false);
});
