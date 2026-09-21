// Los 32 estados de la República — lista fija, no derivada de datos (a
// diferencia de admin/src/lib/mexicoEstados.ts, que infiere un estado a
// partir de texto libre de ciudad; aquí el usuario elige directo de esta
// lista, así que no hace falta ningún mapeo).
export const ESTADOS_MEXICO: string[] = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
];

// Devuelve el estado tal como está en la lista oficial, o null si no es uno
// de los 32 (o viene vacío). Es la única puerta de entrada para guardar el
// estado de residencia del usuario: así nunca queda texto libre en la base.
export function normalizeEstado(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return ESTADOS_MEXICO.find((e) => e === v) ?? null;
}
