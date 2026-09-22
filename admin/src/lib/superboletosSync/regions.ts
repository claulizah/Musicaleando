// Catálogo de regiones (una por estado) y categorías de Superboletos —
// archivos JSON públicos servidos por su CDN (CloudFront), la MISMA fuente
// que usa el propio sitio para poblar sus selectores. No pasa por
// superboletos.com ni por el API Gateway protegido con OAuth (ese sí queda
// descartado, ver README de este directorio); es un CDN público sin
// CAPTCHA ni credenciales, confirmado con curl (200, sin headers especiales).
//
// El "código ofuscado" que trae el parámetro `region` de la URL
// (`?region=t6REMted6UdjV6_8GnQGlg`) resultó ser, uno por estado — 32
// estados + "OTRO" —, no uno por ciudad: no hace falta iterar cientos de
// ciudades, solo 32 regiones.
const CDN_BASE = 'https://dl09mj2qf37fz.cloudfront.net/SuperBoletosRepositorio/apps/jsonCache/27768';

export type Region = { estado: string; regionId: string };

type RawRegion = { nombreEstado: string; region_id: string; label: string };
type RawCategory = { name: string; category_id: string };

export async function fetchRegions(): Promise<Region[]> {
  const res = await fetch(`${CDN_BASE}/catalogos/regions.json`);
  if (!res.ok) throw new Error(`No se pudo leer el catálogo de regiones (${res.status}).`);
  const [data] = (await res.json()) as [{ es: RawRegion[] }];
  return data.es
    .filter((r) => r.label !== 'OTRO')
    .map((r) => ({ estado: r.nombreEstado, regionId: r.region_id }));
}

// No se usa hoy (el script filtra por el nombre visible de la pestaña, más
// robusto que adivinar un query param interno), pero queda disponible por si
// hace falta filtrar por categoría de otra forma más adelante.
export async function fetchMusicCategoryNames(): Promise<string[]> {
  const res = await fetch(`${CDN_BASE}/catalogos/category.json`);
  if (!res.ok) throw new Error(`No se pudo leer el catálogo de categorías (${res.status}).`);
  const [data] = (await res.json()) as [{ es: RawCategory[] }];
  return data.es.filter((c) => c.name === 'Conciertos' || c.name === 'Festivales').map((c) => c.name);
}
