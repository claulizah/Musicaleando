import test from 'node:test';
import assert from 'node:assert/strict';
import { stripCitySuffix } from '../../admin/src/lib/artistNameCleanup.ts';

test('quita " en <Ciudad>" cuando coincide con la ciudad del evento', () => {
  assert.equal(stripCitySuffix('Anabanta en Aguascalientes', { ciudad: 'Aguascalientes' }), 'Anabanta');
});

test('tolera acentos, mayúsculas y ciudad más larga ("Querétaro" ~ "Santiago de Querétaro")', () => {
  assert.equal(stripCitySuffix('Hocico en Queretaro', { ciudad: 'Santiago de Querétaro' }), 'Hocico');
});

test('quita el año que sigue a la ciudad, pero no un año que es parte del nombre', () => {
  assert.equal(stripCitySuffix('Rata Blanca en Monterrey 2026', { ciudad: 'Monterrey' }), 'Rata Blanca');
  assert.equal(stripCitySuffix('Cumbiazo Fest 2026 en Monterrey', { ciudad: 'Monterrey' }), 'Cumbiazo Fest 2026');
});

test('reconoce el estado, el foro y la abreviatura CDMX', () => {
  assert.equal(stripCitySuffix('Jacinto en Puebla', { ciudad: 'San Andrés Cholula', estado: 'Puebla' }), 'Jacinto');
  assert.equal(stripCitySuffix('La Lupita en La Marakita', { ciudad: 'Ciudad de México', venue: 'La Marakita' }), 'La Lupita');
  assert.equal(stripCitySuffix('Amorphis en CDMX', { ciudad: 'Ciudad de México' }), 'Amorphis');
});

test('solo corta el " en " que coincide con el lugar (títulos con "en" adentro se respetan)', () => {
  assert.equal(stripCitySuffix('Amor en Tiempos de Guerra en Puebla', { ciudad: 'Puebla' }), 'Amor en Tiempos de Guerra');
  assert.equal(stripCitySuffix('Cielo en Ruinas', { ciudad: 'Puebla' }), 'Cielo en Ruinas');
});

test('sin ciudad/lugar con qué comparar, o si nada coincide, deja el nombre tal cual (no adivina)', () => {
  assert.equal(stripCitySuffix('Anabanta en Aguascalientes', {}), 'Anabanta en Aguascalientes');
  assert.equal(stripCitySuffix('Anabanta en Aguascalientes', { ciudad: null, estado: null, venue: null }), 'Anabanta en Aguascalientes');
  assert.equal(stripCitySuffix('Pastilla en Satélite', { ciudad: 'Tlalnepantla', estado: 'Estado de México' }), 'Pastilla en Satélite');
});

test('nunca deja el nombre vacío', () => {
  assert.equal(stripCitySuffix(' en Puebla', { ciudad: 'Puebla' }), ' en Puebla');
});
