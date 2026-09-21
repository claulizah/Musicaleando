import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  festivalDay,
  formatHora24,
  formatRango,
  groupByNivel,
  groupLineupByDay,
  hasRealHorario,
  hasSchedule,
  nivelOf,
  sortByHorario,
} from '../../src/lib/lineupSchedule.ts';

test('la hora se lee tal cual está guardada (hora de pared), sin importar la zona del teléfono', () => {
  assert.equal(formatHora24('2026-11-20T20:20:00+00:00'), '20:20');
  assert.equal(formatHora24('2026-11-20 08:05:00+00'), '08:05');
  assert.equal(formatRango('2026-11-20T20:20:00+00:00', '2026-11-20T21:20:00+00:00'), '20:20–21:20');
  assert.equal(formatRango('2026-11-20T20:20:00+00:00', null), '20:20');
});

test('un horario a las 00:00 es solo el día (placeholder): no se muestra como hora', () => {
  assert.equal(hasRealHorario('2026-11-20T00:00:00+00:00'), false);
  assert.equal(formatHora24('2026-11-20T00:00:00+00:00'), null);
  assert.equal(formatRango('2026-11-20T00:00:00+00:00', null), null);
  assert.equal(hasRealHorario(null), false);
  assert.equal(hasRealHorario('basura'), false);
});

test('día del festival: un set de 00:00–05:59 cuenta para la noche anterior; un placeholder para su fecha', () => {
  assert.equal(festivalDay('2026-11-21T22:30:00+00:00'), '2026-11-21');
  assert.equal(festivalDay('2026-11-22T01:15:00+00:00'), '2026-11-21');
  assert.equal(festivalDay('2026-11-22T05:59:00+00:00'), '2026-11-21');
  assert.equal(festivalDay('2026-11-22T06:00:00+00:00'), '2026-11-22');
  assert.equal(festivalDay('2026-11-22T00:00:00+00:00'), '2026-11-22');
  assert.equal(festivalDay('2026-03-01T02:00:00+00:00'), '2026-02-28', 'cruza el fin de mes');
  assert.equal(festivalDay(null), null);
});

test('agrupar por día: el set de la 1 a.m. queda en su día del cartel, no en el siguiente', () => {
  const lineup = [
    { artista: 'A', horario: '2026-11-20T22:00:00+00:00' },
    { artista: 'B', horario: '2026-11-21T00:45:00+00:00' }, // sigue siendo el viernes 20
    { artista: 'C', horario: '2026-11-21T19:00:00+00:00' },
    { artista: 'D', horario: null },
  ];
  const groups = groupLineupByDay(lineup, '2026-11-20', '2026-11-22')!;
  assert.deepEqual(
    groups.map((g) => [g.day, g.items.map((i) => i.artista)]),
    [
      ['2026-11-20', ['A', 'B']],
      ['2026-11-21', ['C']],
      [null, ['D']],
    ],
  );
});

test('evento de un solo día no se agrupa', () => {
  assert.equal(groupLineupByDay([{ horario: null }], '2026-11-20', '2026-11-20'), null);
  assert.equal(groupLineupByDay([{ horario: null }], null, null), null);
});

test('vista por nivel: estelares arriba, luego destacados y el resto; sin nivel = general', () => {
  const items = [
    { artista: 'Uno', nivel: null },
    { artista: 'Cabeza', nivel: 'estelar' },
    { artista: 'Medio', nivel: 'destacado' },
    { artista: 'Dos', nivel: 'raro' },
    { artista: 'Cabeza 2', nivel: 'estelar' },
  ];
  assert.equal(nivelOf({ nivel: 'raro' }), 'general');
  const g = groupByNivel(items);
  assert.deepEqual(
    g.map((x) => [x.nivel, x.items.map((i) => i.artista)]),
    [
      ['estelar', ['Cabeza', 'Cabeza 2']],
      ['destacado', ['Medio']],
      ['general', ['Uno', 'Dos']],
    ],
  );
  assert.deepEqual(groupByNivel([{ nivel: null }]).map((x) => x.nivel), ['general']);
});

test('vista por horario: ordena por hora de inicio y deja al final lo que no tiene hora', () => {
  const items = [
    { artista: 'Sin hora', horario: null },
    { artista: 'Tarde', horario: '2026-11-20T22:00:00+00:00' },
    { artista: 'Madrugada', horario: '2026-11-21T00:30:00+00:00' },
    { artista: 'Temprano', horario: '2026-11-20T14:10:00+00:00' },
    { artista: 'Solo día', horario: '2026-11-20T00:00:00+00:00' },
  ];
  assert.deepEqual(
    sortByHorario(items).map((i) => i.artista),
    ['Temprano', 'Tarde', 'Madrugada', 'Sin hora', 'Solo día'],
  );
  assert.equal(hasSchedule(items), true);
  assert.equal(hasSchedule([{ horario: null }, { horario: '2026-11-20T00:00:00+00:00' }]), false);
});

test('la copia de la app y la del admin tienen exactamente la misma lógica', () => {
  const code = (p: string) =>
    readFileSync(new URL(p, import.meta.url), 'utf8')
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
  assert.equal(code('../../src/lib/lineupSchedule.ts'), code('../../admin/src/lib/lineupSchedule.ts'));
});
