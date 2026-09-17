import type { PostgrestError } from '@supabase/supabase-js';

// supabase-js arma un GET con el filtro .in(...) embebido en la URL — con
// suficientes IDs esa URL se vuelve demasiado larga y algo delante de
// Postgres (el proxy/CDN, no PostgREST) la rechaza con un 400 "Bad Request"
// genérico, sin código ni mensaje real de Postgres (mismo síntoma que ya se
// encontró y arregló en approveCandidatesBulk del admin). festivals ya tiene
// 762+ filas reales y sigue creciendo — cualquier .in('festival_id', ...)
// con TODOS los IDs revienta apenas cruza ese límite. Se trae en lotes
// chicos y se combinan los resultados en vez de una sola llamada gigante.
const CHUNK_SIZE = 100;

export async function fetchAllByIds<T>(
  ids: string[],
  // PromiseLike (no Promise) porque un query builder de supabase-js es un
  // "thenable" — implementa .then() pero no es una instancia real de
  // Promise hasta que se resuelve.
  fetchChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const { data, error } = await fetchChunk(chunk);
    if (error) return { data: results, error };
    results.push(...(data ?? []));
  }
  return { data: results, error: null };
}
