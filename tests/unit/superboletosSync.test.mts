import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findPossibleDuplicate,
  pareceMusica,
  parseCityState,
  titleCaseIfShouting,
} from '../../admin/src/lib/superboletosSync/extract.ts';

test('titleCaseIfShouting: solo actúa si la cadena viene TODA en mayúsculas', () => {
  assert.equal(titleCaseIfShouting('PEQUEÑOS MUSICAL'), 'Pequeños Musical');
  assert.equal(titleCaseIfShouting('ALAN PARSONS THE SHOW MUST GO ON'), 'Alan Parsons The Show Must Go On');
  assert.equal(titleCaseIfShouting('Harlem Globetrotters'), 'Harlem Globetrotters', 'mixto no se toca');
});

test('parseCityState: separa "Ciudad, Estado" (formato real confirmado en vivo)', () => {
  assert.deepEqual(parseCityState('Querétaro, Querétaro'), { ciudad: 'Querétaro', estado: 'Querétaro' });
  assert.deepEqual(parseCityState('Ciudad de México, Ciudad de México'), {
    ciudad: 'Ciudad de México',
    estado: 'Ciudad de México',
  });
});

test('parseCityState: sin coma, usa el mismo texto para ciudad y estado', () => {
  assert.deepEqual(parseCityState('CDMX'), { ciudad: 'CDMX', estado: 'CDMX' });
});

test('pareceMusica: descarta lo claramente no musical visto en la investigación en vivo, deja pasar el resto', () => {
  assert.equal(pareceMusica('Harlem Globetrotters'), false);
  assert.equal(pareceMusica('Tradicional Corrida Fiestas Patrias'), false, 'toros — se coló en la lista sin filtrar');
  assert.equal(pareceMusica('Lucha Libre AAA'), false);
  assert.equal(pareceMusica('Pequeños Musical'), true);
  assert.equal(pareceMusica('Alan Parsons the Show Must Go On'), true);
  assert.equal(pareceMusica('Rosa de Dos Aromas'), true, 'contiene "rosa" pero no matchea la lista de no-música');
});

test('findPossibleDuplicate: nombre+ciudad contra el catálogo (sin fecha real que comparar)', () => {
  const festivals = [{ id: 'f1', nombre: 'Alan Parsons', ciudad: 'Querétaro' }];
  assert.equal(findPossibleDuplicate({ nombre: 'Alan Parsons', ciudad: 'Querétaro' }, festivals), 'f1');
  assert.equal(findPossibleDuplicate({ nombre: 'Alan Parsons', ciudad: 'Mérida' }, festivals), null);
  assert.equal(findPossibleDuplicate({ nombre: 'Otro Artista', ciudad: 'Querétaro' }, festivals), null);
});
