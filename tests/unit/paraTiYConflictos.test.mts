import test from 'node:test';
import assert from 'node:assert/strict';
import { findConflicts } from '../../src/lib/scheduleConflicts.ts';
import { selectParaTi } from '../../src/lib/paraTi.ts';

// hora de pared guardada como UTC (ver lineupSchedule.ts)
const t = (hhmm: string) => `2026-11-14T${hhmm}:00+00:00`;

test('conflictos: traslape real entre escenarios distintos', () => {
  const c = findConflicts([
    { id: 'a', horario: t('20:00'), horario_fin: t('21:30') },
    { id: 'b', horario: t('21:00'), horario_fin: t('22:00') },
    { id: 'c', horario: t('23:00'), horario_fin: t('23:45') },
  ]);
  assert.deepEqual(c.get('a'), ['b']);
  assert.deepEqual(c.get('b'), ['a']);
  assert.equal(c.has('c'), false);
});

test('conflictos: tocarse en el borde no es conflicto', () => {
  const c = findConflicts([
    { id: 'a', horario: t('20:00'), horario_fin: t('21:00') },
    { id: 'b', horario: t('21:00'), horario_fin: t('22:00') },
  ]);
  assert.equal(c.size, 0);
});

test('conflictos: sin hora de fin se asume 60 min; sin hora real no se compara', () => {
  const c = findConflicts([
    { id: 'a', horario: t('20:00') },
    { id: 'b', horario: t('20:30') },
    { id: 'c', horario: '2026-11-14T00:00:00+00:00' }, // solo día
    { id: 'd', horario: null },
  ]);
  assert.deepEqual(c.get('a'), ['b']);
  assert.equal(c.has('c'), false);
  assert.equal(c.has('d'), false);
});

const mk = (id: string, tipo: string, fecha: string, artists: (string | null)[], venue: string | null = null) => ({
  festival: { id, tipo, fecha_inicio: fecha, estado_evento: 'activo', venue_id: venue },
  lineup: artists.map((artist_id) => ({ artist_id })),
});
const base = { tipo: 'concierto' as const, estado: null, venueState: () => null, hoy: '2026-10-01' };

test('para ti: prioriza artistas seguidos, del tipo de la pestaña, próximos y ordenados', () => {
  const r = selectParaTi(
    [
      mk('e2', 'concierto', '2026-12-01', ['x']),
      mk('e1', 'concierto', '2026-11-01', ['x']),
      mk('f', 'festival', '2026-11-02', ['x']),
      mk('old', 'concierto', '2026-09-01', ['x']),
      mk('otro', 'concierto', '2026-11-05', ['y']),
    ],
    { ...base, followedIds: new Set(['x']) },
  );
  assert.equal(r.kind, 'seguidos');
  assert.deepEqual(r.entries.map((e) => e.festival.id), ['e1', 'e2']);
});

test('para ti: sin follows con evento, respalda por estado del usuario', () => {
  const r = selectParaTi([mk('e1', 'concierto', '2026-11-01', ['y'], 'v1'), mk('e2', 'concierto', '2026-11-02', ['y'], 'v2')], {
    ...base,
    followedIds: new Set(['x']),
    estado: 'Puebla',
    venueState: (v) => (v === 'v1' ? 'Puebla' : 'Jalisco'),
  });
  assert.equal(r.kind, 'cerca');
  assert.deepEqual(r.entries.map((e) => e.festival.id), ['e1']);
});

test('para ti: usuario nuevo (sin follows ni estado) -> vacío, la sección no se muestra', () => {
  const r = selectParaTi([mk('e1', 'concierto', '2026-11-01', ['y'])], { ...base, followedIds: new Set() });
  assert.deepEqual(r, { kind: null, entries: [] });
});
