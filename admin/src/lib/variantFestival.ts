import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { normalizeArtistName } from './artists';
import { sameIdSet } from './variantSets';

// Regla "un solo evento por artista, fecha y recinto": al aprobar un candidato,
// si YA hay un festival activo en el mismo recinto, con las mismas fechas y
// exactamente los mismos artistas, el candidato es solo otra variante de
// boleto (General/VIP/Banamex Plus/Meet & Greet…) del mismo evento y no debe
// crear otro registro.
//
// Deliberadamente conservadora:
//  - sin recinto o sin artistas conocidos -> no decide (null);
//  - si algún artista todavía no existe en `artists`, no puede ser una
//    variante de un evento ya publicado (su conjunto de artistas sería distinto);
//  - fechas EXACTAMENTE iguales y conjunto de artistas idéntico: un Abono de
//    varios días y un boleto de un solo día tienen fechas y line-ups distintos,
//    así que NO se fusionan (esos casos se revisan a mano);
//  - solo compara contra festivales 'activo' (nunca contra archivados).

export type VariantMatch = { id: string; nombre: string };

export async function findVariantFestival(
  supabase: SupabaseClient<Database>,
  params: { venue_id: string | null; fecha_inicio: string; fecha_fin: string; artistNames: string[] },
): Promise<VariantMatch | null> {
  if (!params.venue_id) return null;
  const keys = [...new Set(params.artistNames.map((n) => normalizeArtistName(n)).filter(Boolean))];
  if (keys.length === 0) return null;

  const { data: artists } = await supabase.from('artists').select('id, normalized_name').in('normalized_name', keys);
  const ids = (artists ?? []).map((a) => a.id);
  if (ids.length !== keys.length) return null; // algún artista es nuevo -> no es una variante

  const { data: candidates } = await supabase
    .from('festivals')
    .select('id, nombre')
    .eq('venue_id', params.venue_id)
    .eq('fecha_inicio', params.fecha_inicio)
    .eq('fecha_fin', params.fecha_fin)
    .eq('estado_evento', 'activo');

  for (const f of candidates ?? []) {
    const { data: lineup } = await supabase.from('festival_lineup').select('artist_id').eq('festival_id', f.id);
    const existing = (lineup ?? []).map((l) => l.artist_id).filter((x): x is string => Boolean(x));
    if (sameIdSet(existing, ids)) return { id: f.id, nombre: f.nombre };
  }
  return null;
}
