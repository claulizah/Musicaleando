import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateMatch } from '../../admin/src/lib/candidateDuplicates.ts';

const festivals = [
  { id: 'f1', nombre: 'Corona Capital 2026', ciudad: 'Ciudad de México', fecha_inicio: '2026-11-20', estado_evento: 'activo' },
  { id: 'f2', nombre: 'Ana Torroja', ciudad: 'Ciudad de México', fecha_inicio: '2026-09-17', estado_evento: 'archivado' },
];
const candidates = [{ id: 'c1', nombre: 'Mago de Oz', ciudad: 'Puebla', fecha_inicio: '2026-10-10' }];

test('duplica un evento ya aprobado (type "festival") — mismo nombre+fecha+ciudad', () => {
  const m = findDuplicateMatch({ nombre: 'Corona Capital 2026', ciudad: 'Ciudad de México', fecha_inicio: '2026-11-21' }, festivals, candidates);
  assert.deepEqual(m, { type: 'festival', id: 'f1', nombre: 'Corona Capital 2026' });
});

test('duplica OTRO candidato pendiente (type "candidate") — el caso que antes se perdía al guardar', () => {
  const m = findDuplicateMatch({ nombre: 'Mago de Oz', ciudad: 'Puebla', fecha_inicio: '2026-10-10' }, festivals, candidates);
  assert.deepEqual(m, { type: 'candidate', id: 'c1', nombre: 'Mago de Oz' });
});

test('los festivales se revisan antes que los candidatos pendientes', () => {
  const m = findDuplicateMatch(
    { nombre: 'Corona Capital 2026', ciudad: 'Ciudad de México', fecha_inicio: '2026-11-20' },
    festivals,
    [{ id: 'c9', nombre: 'Corona Capital 2026', ciudad: 'Ciudad de México', fecha_inicio: '2026-11-20' }],
  );
  assert.equal(m?.type, 'festival');
});

test('mismo nombre que un evento archivado pero fecha muy distinta -> "archivado" (probable re-anuncio)', () => {
  const m = findDuplicateMatch({ nombre: 'Ana Torroja', ciudad: 'Ciudad de México', fecha_inicio: '2027-03-10' }, festivals, []);
  assert.deepEqual(m, { type: 'archivado', id: 'f2', nombre: 'Ana Torroja', fecha_inicio: '2026-09-17' });
});

test('evento genuinamente nuevo -> sin duplicado', () => {
  const m = findDuplicateMatch({ nombre: 'Artista Nuevo', ciudad: 'Toluca', fecha_inicio: '2027-01-01' }, festivals, candidates);
  assert.equal(m, null);
});
