// PostgREST trae como máximo 1000 filas por consulta si no se pide más —
// una consulta como `select('*').eq('estado', 'pendiente')` sin `.range()`
// se corta ahí en silencio, sin error, si el conteo real supera eso. Ya
// pasó dos veces en este proyecto con un problema relacionado (URL
// demasiado larga en `.in()`: useFestivalStore, approveCandidatesBulk) —
// esto es la misma familia de bug (un límite invisible de PostgREST), en
// otra consulta. Hoy /candidatos trae 146 pendientes (muy por debajo de
// 1000), así que no hay pérdida de datos actual — esto es prevención antes
// de que la cifra real lo alcance (con Superboletos activado algún día,
// una sola corrida ya aportaría 258+ candidatos).
//
// Uso: fetchAllRows((from, to) => supabase.from('t').select('*').range(from, to))
export async function fetchAllRows<T>(
  // PromiseLike, no Promise — un query builder de supabase-js es "thenable"
  // pero no un Promise real hasta que se le hace await/.then(), y así se usa
  // tal cual en cada llamada (sin envolver en Promise.resolve por separado).
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: all, error: error.message };
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return { data: all, error: null };
}
