import type { PostgrestError } from '@supabase/supabase-js';

// supabase-js arma un GET con el filtro .in(...) embebido en la URL — con
// suficientes IDs esa URL se vuelve demasiado larga y algo delante de
// Postgres (el proxy/CDN, no PostgREST) la rechaza con un 400 "Bad Request"
// genérico, sin código ni mensaje real de Postgres (mismo síntoma que ya se
// encontró y arregló en approveCandidatesBulk del admin). festivals ya tiene
// 762+ filas reales y sigue creciendo — cualquier .in('festival_id', ...)
// con TODOS los IDs revienta apenas cruza ese límite. Se trae en lotes
// chicos y se combinan los resultados en vez de una sola llamada gigante.
//
// 100 IDs por lote (~3.8-3.9KB de URL) cabía bajo el límite de Cloudflare/
// Supabase, pero reventó igual en un dispositivo real sobre datos móviles
// de AT&T con "Bad Request" — los proxies transparentes de algunas
// operadoras celulares imponen límites de URL bastante más estrictos que
// el de la infraestructura de Supabase, y no se detectan probando por
// WiFi o escritorio. 40 IDs por lote (~1.5KB) da margen real también ahí.
const CHUNK_SIZE = 40;

export async function fetchAllByIds<T>(
  ids: string[],
  // PromiseLike (no Promise) porque un query builder de supabase-js es un
  // "thenable" — implementa .then() pero no es una instancia real de
  // Promise hasta que se resuelve.
  fetchChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE));
  }

  // Los lotes son independientes entre sí (cada uno filtra un subconjunto
  // disjunto de IDs) — pedirlos uno por uno con await en un for era la otra
  // mitad de por qué la carga de Conciertos y festivales tardaba tanto
  // (~20 lotes secuenciales solo para esta tabla, multiplicado por cada
  // tabla que usa este helper). En paralelo, el tiempo total es el de UN
  // lote, no la suma de los 20.
  const settled = await Promise.all(chunks.map((chunk) => fetchChunk(chunk)));

  const results: T[] = [];
  for (const { data, error } of settled) {
    if (error) return { data: results, error };
    results.push(...(data ?? []));
  }
  return { data: results, error: null };
}
