import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHorario } from '../../admin/src/lib/normalizeHorario.ts';
import { buildHorarios, resolveDayFromLabel, to24h } from '../../admin/src/lib/lineupTimes.ts';

test('normalizeHorario: solo hora se combina con la fecha del evento como hora de pared', () => {
  assert.equal(normalizeHorario('2026-11-20', '17:00'), '2026-11-20T17:00:00+00:00');
  assert.equal(normalizeHorario('2026-11-20', '8:05'), '2026-11-20T08:05:00+00:00');
});

test('normalizeHorario: un offset se descarta (el cartel dice 20:00, no 02:00 UTC)', () => {
  assert.equal(normalizeHorario('2026-11-20', '2026-10-03T20:00:00-06:00'), '2026-10-03T20:00:00+00:00');
  assert.equal(normalizeHorario('2026-11-20', '2026-10-03T20:00:00Z'), '2026-10-03T20:00:00+00:00');
  assert.equal(normalizeHorario('2026-11-20', '2026-10-03 20:00'), '2026-10-03T20:00:00+00:00');
});

test('normalizeHorario: solo fecha = placeholder de las 00:00; lo irreconocible o imposible = null', () => {
  assert.equal(normalizeHorario('2026-11-20', '2026-10-03'), '2026-10-03T00:00:00+00:00');
  assert.equal(normalizeHorario('2026-11-20', '25:70'), null);
  assert.equal(normalizeHorario('2026-11-20', '2026-02-30'), null);
  assert.equal(normalizeHorario('2026-11-20', 'mañana'), null);
  assert.equal(normalizeHorario('2026-11-20', '   '), null);
  assert.equal(normalizeHorario('2026-11-20', null), null);
});

test('to24h: marca am/pm explícita manda; sin marca depende de assumePm', () => {
  assert.equal(to24h('20:20'), '20:20');
  assert.equal(to24h('8:10'), '08:10');
  assert.equal(to24h('8:10', true), '20:10');
  assert.equal(to24h('8:10 pm'), '20:10');
  assert.equal(to24h('8:10PM', false), '20:10');
  assert.equal(to24h('8 p.m.'), '20:00');
  assert.equal(to24h('12:30 am'), '00:30');
  assert.equal(to24h('12:30 pm'), '12:30');
  assert.equal(to24h('9:00 am', true), '09:00', 'una marca explícita no se toca aunque assumePm esté activo');
  assert.equal(to24h('14:00', true), '14:00');
  assert.equal(to24h('13:00 pm'), null);
  assert.equal(to24h('25:00'), null);
  assert.equal(to24h('abc'), null);
  assert.equal(to24h(null), null);
});

test('buildHorarios: horas normales quedan en el día del cartel', () => {
  assert.deepEqual(buildHorarios('2026-11-20', '20:20', '21:20'), {
    horario: '2026-11-20T20:20:00+00:00',
    horario_fin: '2026-11-20T21:20:00+00:00',
  });
  assert.deepEqual(buildHorarios('2026-11-20', '20:20', null), {
    horario: '2026-11-20T20:20:00+00:00',
    horario_fin: null,
  });
  assert.deepEqual(buildHorarios('2026-11-20', null, '21:00'), { horario: null, horario_fin: null });
});

test('buildHorarios: acepta horas sin cero a la izquierda y las deja bien formadas', () => {
  assert.deepEqual(buildHorarios('2026-11-20', '8:10', '9:05'), {
    horario: '2026-11-20T08:10:00+00:00',
    horario_fin: '2026-11-20T09:05:00+00:00',
  });
});

test('buildHorarios: cruzar la medianoche pasa al día calendario siguiente', () => {
  assert.deepEqual(buildHorarios('2026-11-20', '23:30', '00:45'), {
    horario: '2026-11-20T23:30:00+00:00',
    horario_fin: '2026-11-21T00:45:00+00:00',
  });
  // un set que arranca después de medianoche sigue siendo "el viernes" en el cartel
  assert.deepEqual(buildHorarios('2026-11-20', '00:30', '01:30'), {
    horario: '2026-11-21T00:30:00+00:00',
    horario_fin: '2026-11-21T01:30:00+00:00',
  });
  assert.equal(buildHorarios('2026-12-31', '23:00', '00:30').horario_fin, '2027-01-01T00:30:00+00:00');
});

test('buildHorarios: un fin absurdo se reporta en vez de guardarse', () => {
  const r = buildHorarios('2026-11-20', '23:30', '23:00');
  assert.equal(r.horario_fin, null);
  assert.ok(r.error);
});

test('resolveDayFromLabel: encuentra el día del cartel dentro del rango del evento', () => {
  // Corona Capital 2026: vie 20 a dom 22 nov
  assert.equal(resolveDayFromLabel('Domingo 22', '2026-11-20', '2026-11-22'), '2026-11-22');
  assert.equal(resolveDayFromLabel('SÁBADO 21', '2026-11-20', '2026-11-22'), '2026-11-21');
  assert.equal(resolveDayFromLabel('Viernes', '2026-11-20', '2026-11-22'), '2026-11-20');
  assert.equal(resolveDayFromLabel('Viernes 20 Noviembre', '2026-11-20', '2026-11-22'), '2026-11-20');
  assert.equal(resolveDayFromLabel('21', '2026-11-20', '2026-11-22'), '2026-11-21');
});

test('resolveDayFromLabel: si no coincide con el rango o no hay pista, null (no se inventa)', () => {
  assert.equal(resolveDayFromLabel('Domingo 16', '2026-11-20', '2026-11-22'), null);
  assert.equal(resolveDayFromLabel('Viernes 21', '2026-11-20', '2026-11-22'), null, 'el día y la fecha no coinciden');
  assert.equal(resolveDayFromLabel('Main Stage', '2026-11-20', '2026-11-22'), null);
  assert.equal(resolveDayFromLabel(null, '2026-11-20', '2026-11-22'), null);
});
