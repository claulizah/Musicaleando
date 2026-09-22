import test from 'node:test';
import assert from 'node:assert/strict';
import {
  esFechaFutura,
  esMusicaVigente,
  findPossibleDuplicate,
  parseFechaPrimeraPresentacion,
  parseSearchEntry,
  titleCaseIfShouting,
  type RawSearchEntry,
} from '../../admin/src/lib/superboletosSync/extract.ts';

test('titleCaseIfShouting: solo actúa si la cadena viene TODA en mayúsculas', () => {
  assert.equal(titleCaseIfShouting('PEQUEÑOS MUSICAL'), 'Pequeños Musical');
  assert.equal(titleCaseIfShouting('ALAN PARSONS THE SHOW MUST GO ON'), 'Alan Parsons The Show Must Go On');
  assert.equal(titleCaseIfShouting('Harlem Globetrotters'), 'Harlem Globetrotters', 'mixto no se toca');
});

test('parseFechaPrimeraPresentacion: "DD/MM/YYYY HH:MM:SS" real de la fuente -> ISO', () => {
  assert.equal(parseFechaPrimeraPresentacion('25/10/2026 18:30:00'), '2026-10-25');
  assert.equal(parseFechaPrimeraPresentacion('05/01/2027 21:00:00'), '2027-01-05');
});

test('parseFechaPrimeraPresentacion: vacío o irreconocible -> null (no se inventa)', () => {
  assert.equal(parseFechaPrimeraPresentacion(''), null);
  assert.equal(parseFechaPrimeraPresentacion('  '), null);
  assert.equal(parseFechaPrimeraPresentacion('mañana'), null);
});

test('esMusicaVigente: exige claveTipoEvento exacto (Conciertos/Festivales) y estatus NORMAL', () => {
  const base: RawSearchEntry = {
    eventoId: 'x',
    nombreEvento: 'X',
    nombreRecinto: 'V',
    nombreCiudad: 'C',
    nombreEstado: 'E',
    claveTipoEvento: 'Conciertos',
    claveEstatusFechaEvento: 'NORMAL',
    fechaPrimeraPresentacion: '',
    fechas: '',
    precioMinimo: '0',
    precioMaximo: '0',
  };
  assert.equal(esMusicaVigente(base), true);
  assert.equal(esMusicaVigente({ ...base, claveTipoEvento: 'Festivales' }), true);
  assert.equal(esMusicaVigente({ ...base, claveTipoEvento: 'Deportes' }), false);
  assert.equal(esMusicaVigente({ ...base, claveTipoEvento: 'CONCIERTO' }), false, 'variante espuria vista en datos reales, no cuenta');
  assert.equal(esMusicaVigente({ ...base, claveEstatusFechaEvento: 'CANCELADO' }), false);
});

test('esFechaFutura: sin fecha parseada se deja pasar; con fecha, se exige >= hoy', () => {
  assert.equal(esFechaFutura(null, '2026-09-22'), true);
  assert.equal(esFechaFutura('2026-09-22', '2026-09-22'), true, 'el día de hoy todavía cuenta');
  assert.equal(esFechaFutura('2026-09-21', '2026-09-22'), false);
  assert.equal(esFechaFutura('2026-09-23', '2026-09-22'), true);
});

test('parseSearchEntry: arma el candidato con nombre/venue/ciudad normalizados, fecha y link real', () => {
  const raw: RawSearchEntry = {
    eventoId: 'myhzRA8fYVh_5MUWIxkqcw',
    nombreEvento: 'KAPO AFRO ROSA TOUR 2026',
    nombreRecinto: 'AUD. JOSEFA ORTIZ',
    nombreCiudad: 'Querétaro',
    nombreEstado: 'Querétaro',
    claveTipoEvento: 'Conciertos',
    claveEstatusFechaEvento: 'NORMAL',
    fechaPrimeraPresentacion: '03/11/2026 21:00:00',
    fechas: '03 de Noviembre 21:00 Hrs.',
    precioMinimo: '450',
    precioMaximo: '1200',
  };
  const ev = parseSearchEntry(raw);
  assert.deepEqual(ev, {
    eventoId: 'myhzRA8fYVh_5MUWIxkqcw',
    nombre: 'Kapo Afro Rosa Tour 2026',
    fecha_iso: '2026-11-03',
    fecha_texto: '03 de Noviembre 21:00 Hrs.',
    venue: 'Aud. Josefa Ortiz',
    ciudad: 'Querétaro',
    estado: 'Querétaro',
    link: 'https://www.superboletos.com/landing-evento/myhzRA8fYVh_5MUWIxkqcw',
    price_min: 450,
    price_max: 1200,
  });
});

test('parseSearchEntry: precio en 0 se guarda como null (no hay precio real que mostrar)', () => {
  const raw: RawSearchEntry = {
    eventoId: 'x',
    nombreEvento: 'X',
    nombreRecinto: null,
    nombreCiudad: 'C',
    nombreEstado: 'E',
    claveTipoEvento: 'Conciertos',
    claveEstatusFechaEvento: 'NORMAL',
    fechaPrimeraPresentacion: '',
    fechas: '',
    precioMinimo: '0',
    precioMaximo: '0',
  };
  const ev = parseSearchEntry(raw);
  assert.deepEqual([ev.price_min, ev.price_max, ev.venue], [null, null, null]);
});

test('findPossibleDuplicate: nombre+fecha+ciudad contra el catálogo', () => {
  const festivals = [{ id: 'f1', nombre: 'Alan Parsons', ciudad: 'Querétaro', fecha_inicio: '2026-10-21' }];
  assert.equal(
    findPossibleDuplicate({ nombre: 'Alan Parsons', ciudad: 'Querétaro', fecha_iso: '2026-10-21' }, festivals),
    'f1',
  );
  assert.equal(
    findPossibleDuplicate({ nombre: 'Alan Parsons', ciudad: 'Querétaro', fecha_iso: '2027-01-01' }, festivals),
    null,
    'misma ciudad y nombre pero fecha muy distinta: no es el mismo evento',
  );
  assert.equal(
    findPossibleDuplicate({ nombre: 'Otro Artista', ciudad: 'Querétaro', fecha_iso: '2026-10-21' }, festivals),
    null,
  );
});
