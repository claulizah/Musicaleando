import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, weekStart } from '../../admin/src/lib/ticketClicksReport.ts';

test('weekStart devuelve el lunes de la semana', () => {
  assert.equal(weekStart('2026-09-21'), '2026-09-21');
  assert.equal(weekStart('2026-09-23'), '2026-09-21');
  assert.equal(weekStart('2026-09-27'), '2026-09-21');
  assert.equal(weekStart('2026-09-28'), '2026-09-28');
});

test('reporte semanal y por plataforma', () => {
  const now = new Date('2026-09-23T18:00:00Z');
  const d = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  const rows = [
    { festival_id: 'A', plataforma: 'ticketmaster', afiliado: true, created_at: d(0) },
    { festival_id: 'A', plataforma: 'ticketmaster', afiliado: true, created_at: d(2) },
    { festival_id: 'A', plataforma: 'ticketmaster', afiliado: false, created_at: d(9) },
    { festival_id: 'B', plataforma: 'eticket', afiliado: false, created_at: d(1) },
    { festival_id: 'B', plataforma: 'eticket', afiliado: false, created_at: d(20) },
    { festival_id: null, plataforma: 'ticketmaster', afiliado: false, created_at: d(3) },
  ];
  const r = buildReport(rows, 4, now);
  assert.deepEqual(r.weeks, ['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21']);
  assert.equal(r.last7, 4);
  assert.equal(r.last30, 6);
  assert.equal(r.total, 6);
  const a = r.byEvent.find((e) => e.festival_id === 'A');
  assert.deepEqual(a?.perWeek, [0, 0, 1, 2]);
  assert.equal(r.byEvent[0].festival_id, 'A', 'el evento con más clics va primero');
  const tm = r.byPlatform.find((p) => p.plataforma === 'ticketmaster');
  assert.deepEqual([tm?.total, tm?.conAfiliado], [4, 2]);
});

test('la semana se cuenta en hora de México, no en UTC', () => {
  // Domingo 20 sep, 21:00 en México = lunes 21 sep 03:00 UTC: debe caer en la semana del 14, no del 21.
  const now = new Date('2026-09-23T18:00:00Z');
  const r = buildReport([{ festival_id: 'A', plataforma: 'ticketmaster', afiliado: false, created_at: '2026-09-21T03:00:00Z' }], 3, now);
  assert.deepEqual(r.byEvent[0].perWeek, [0, 1, 0]);
});
