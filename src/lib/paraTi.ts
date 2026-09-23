// Sección "Para ti" del catálogo. Prioridad:
//  1) eventos próximos de artistas que el usuario SIGUE (followed_artists);
//  2) si no hay ninguno, respaldo con lo que sí sabemos del perfil: el estado
//     donde vive (users.ciudad ↔ venues.state) -> "Cerca de ti".
// Los géneros del onboarding NO se usan: ni los eventos ni los artistas
// guardan género (ver useEventFilters.ts), así que no hay con qué cruzarlos
// sin construir un sistema de recomendación nuevo. Sin follows ni estado, el
// resultado es vacío y la sección simplemente no se muestra.
export type ParaTiEntry = {
  festival: { id: string; tipo: string; fecha_inicio: string; estado_evento: string; venue_id: string | null };
  lineup: { artist_id: string | null }[];
};

export function selectParaTi<T extends ParaTiEntry>(
  entries: T[],
  opts: {
    tipo: 'festival' | 'concierto';
    followedIds: Set<string>;
    estado: string | null;
    venueState: (venueId: string | null) => string | null;
    hoy: string; // YYYY-MM-DD
    limit?: number;
  },
): { kind: 'seguidos' | 'cerca' | null; entries: T[] } {
  const limit = opts.limit ?? 5;
  const upcoming = entries
    .filter(
      (e) =>
        e.festival.tipo === opts.tipo && e.festival.estado_evento !== 'archivado' && e.festival.fecha_inicio >= opts.hoy,
    )
    .sort((a, b) => a.festival.fecha_inicio.localeCompare(b.festival.fecha_inicio));

  if (opts.followedIds.size > 0) {
    const seguidos = upcoming.filter((e) => e.lineup.some((l) => l.artist_id && opts.followedIds.has(l.artist_id)));
    if (seguidos.length > 0) return { kind: 'seguidos', entries: seguidos.slice(0, limit) };
  }
  if (opts.estado) {
    const cerca = upcoming.filter((e) => opts.venueState(e.festival.venue_id) === opts.estado);
    if (cerca.length > 0) return { kind: 'cerca', entries: cerca.slice(0, limit) };
  }
  return { kind: null, entries: [] };
}
