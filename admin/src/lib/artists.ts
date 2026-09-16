import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Mismo criterio de normalización que el backfill SQL (unaccent + minúsculas
// + espacios colapsados) — deben coincidir para que un artista creado en el
// backfill y uno creado en runtime por este helper nunca queden duplicados.
export function normalizeArtistName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Resuelve un artist_id por nombre, creando el registro en `artists` si no
// existe todavía (comparando por normalized_name para no duplicar por
// mayúsculas/acentos/espacios). Reusado desde cada punto donde se inserta en
// festival_lineup: aprobar candidato, fusionar line-up de póster, importar
// CSV, aprobar candidato de line-up extraído por imagen.
export async function resolveArtistIds(
  supabase: SupabaseClient<Database>,
  names: string[],
): Promise<Map<string, string>> {
  const displayByNormalized = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalizeArtistName(name);
    if (!displayByNormalized.has(key)) displayByNormalized.set(key, name);
  }
  if (displayByNormalized.size === 0) return new Map();

  const keys = [...displayByNormalized.keys()];
  const { data: existing } = await supabase.from('artists').select('id, normalized_name').in('normalized_name', keys);

  const idByNormalized = new Map((existing ?? []).map((a) => [a.normalized_name, a.id]));

  const missing = keys.filter((k) => !idByNormalized.has(k));
  if (missing.length > 0) {
    const { data: inserted, error } = await supabase
      .from('artists')
      .insert(missing.map((k) => ({ name: displayByNormalized.get(k)!, normalized_name: k })))
      .select('id, normalized_name');

    if (error) {
      // Carrera entre dos aprobaciones al mismo tiempo violaría el unique de
      // normalized_name — no es fatal, solo se relee lo que ya quedó insertado.
      const { data: retryExisting } = await supabase
        .from('artists')
        .select('id, normalized_name')
        .in('normalized_name', missing);
      for (const a of retryExisting ?? []) idByNormalized.set(a.normalized_name, a.id);
    } else {
      for (const a of inserted ?? []) idByNormalized.set(a.normalized_name, a.id);
    }
  }

  const result = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const id = idByNormalized.get(normalizeArtistName(name));
    if (id) result.set(name, id);
  }
  return result;
}
