import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { resolveEstado } from './mexicoEstados';

// Mismo criterio de normalización que el backfill (scripts/generate-venues-backfill.mts):
// nombre+ciudad, sin acentos, minúsculas, espacios colapsados. Debe coincidir
// exacto con ese script para que un venue creado ahí y uno creado en runtime
// por este helper nunca queden duplicados.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function venueKey(name: string, city: string): string {
  return `${normalize(name)}|${normalize(city)}`;
}

// Resuelve un venue_id por nombre+ciudad, creando el registro en `venues` si
// no existe todavía. El estado se deriva con resolveEstado (el mismo mapeo
// que ya usa el admin para agrupar) — nunca se pide a mano. Sin nombre o sin
// ciudad no hay venue que crear (el FK queda null, no es obligatorio).
export async function resolveVenueId(
  supabase: SupabaseClient<Database>,
  name: string | null | undefined,
  city: string | null | undefined,
): Promise<string | null> {
  const trimmedName = (name ?? '').trim();
  const trimmedCity = (city ?? '').trim();
  if (!trimmedName || !trimmedCity) return null;

  const key = venueKey(trimmedName, trimmedCity);
  const { data: existing } = await supabase.from('venues').select('id').eq('normalized_name', key).maybeSingle();
  if (existing) return existing.id;

  const state = resolveEstado(trimmedCity);
  const { data: inserted, error } = await supabase
    .from('venues')
    .insert({ name: trimmedName, city: trimmedCity, state, normalized_name: key })
    .select('id')
    .maybeSingle();

  if (error) {
    // Carrera entre dos aprobaciones al mismo tiempo violaría el unique de
    // normalized_name — no es fatal, solo se relee lo que ya quedó insertado.
    const { data: retry } = await supabase.from('venues').select('id').eq('normalized_name', key).maybeSingle();
    return retry?.id ?? null;
  }
  return inserted?.id ?? null;
}
