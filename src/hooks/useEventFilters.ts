import { useMemo, useState } from 'react';
import { FestivalWithIntent } from '../store/useFestivalStore';
import { fetchFestivalPersonalization } from '../lib/spotify';
import { descuentoVigente, mexicoToday, preventaVigente } from '../lib/descuentos';
import type { Tables } from '../types/database';

export type DateFilter = 'todos' | 'proximos7' | 'este_mes';
export type TipoFilter = 'todos' | 'festival' | 'concierto';

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function matchesDateFilter(fechaInicio: string, filter: DateFilter): boolean {
  if (filter === 'todos') return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(fechaInicio + 'T00:00:00');
  if (filter === 'proximos7') {
    const diffDays = (start.getTime() - today.getTime()) / 86_400_000;
    return diffDays >= 0 && diffDays <= 7;
  }
  // 'este_mes'
  return start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth();
}

// Filtro/búsqueda reusable para cualquier lista de FestivalWithIntent — usado
// tanto en el catálogo principal (FestivalHubScreen) como en el selector de
// festival al crear un squad (SquadsScreen), que sufría el mismo problema de
// "lista plana enorme sin buscador" (ver prompt-siguiente-filtros-catalogo-
// eventos.md). Texto libre busca por nombre de evento O nombre de artista
// (via festival_lineup.artista, que ya viene resuelto contra la tabla
// `artists` — ver prompt-siguiente-ficha-artista.md).
//
// Género musical: NO existe hoy ningún tag de género guardado por evento ni
// por artista (Ticketmaster no lo trae en un campo reusable, y el propio
// código de recommend-artists ya documenta que Spotify no expone géneros
// por artista en el tier de esta app). El único filtro por género que se
// puede construir sin inventar datos es "coincide con tus propios géneros"
// reusando fetchFestivalPersonalization (el mismo mecanismo de "festival
// generado por tus gustos"), que compara el line-up contra una muestra en
// vivo de Spotify — por eso es un toggle, no un selector de género
// arbitrario, y por eso se llama UNA sola vez con el line-up combinado de
// todo lo ya filtrado en vez de una vez por evento.
export function useEventFilters(
  allEntries: FestivalWithIntent[],
  misGeneros: string[],
  // Catálogo de lugares (ver useFestivalStore.venues), para el filtro por
  // estado de la República — el estado vive en el venue, no en el festival.
  // Opcional: si no se pasa, el filtro de estado simplemente no ofrece
  // opciones (comportamiento igual al de antes de que existiera la ficha de lugar).
  venues: Tables<'venues'>[] = [],
) {
  // Los eventos archivados (ya vencidos) no se muestran al explorar — salvo
  // uno donde el usuario dijo "Voy" y todavía debe la encuesta post-evento,
  // que vive dentro de la tarjeta del propio evento en esta lista.
  const entries = useMemo(
    () => allEntries.filter((e) => e.festival.estado_evento !== 'archivado' || e.survey.due),
    [allEntries],
  );
  const [query, setQuery] = useState('');
  const [ciudad, setCiudad] = useState<string | null>(null);
  const [estadoRepublica, setEstadoRepublica] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('todos');
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('todos');
  const [soloMisGeneros, setSoloMisGeneros] = useState(false);
  const [soloDescuento, setSoloDescuento] = useState(false);
  const [soloPreventa, setSoloPreventa] = useState(false);
  const [generoMatchArtists, setGeneroMatchArtists] = useState<Set<string> | null>(null);
  const [generoLoading, setGeneroLoading] = useState(false);

  const ciudades = useMemo(() => {
    const set = new Set(entries.map((e) => e.festival.ciudad).filter((c): c is string => Boolean(c)));
    return [...set].sort();
  }, [entries]);

  const venueById = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues]);

  const estadosRepublica = useMemo(() => {
    const set = new Set(
      entries
        .map((e) => (e.festival.venue_id ? venueById.get(e.festival.venue_id)?.state : null))
        .filter((s): s is string => Boolean(s)),
    );
    return [...set].sort();
  }, [entries, venueById]);

  // Cuántos eventos tienen hoy un descuento / una preventa vigente: el chip
  // solo se ofrece si hay algo que filtrar (o ya está activado).
  const promoCounts = useMemo(() => {
    const hoy = mexicoToday(new Date());
    return {
      descuento: entries.filter((e) => descuentoVigente(e.festival, hoy)).length,
      preventa: entries.filter((e) => preventaVigente(e.festival, hoy) !== null).length,
    };
  }, [entries]);

  // Texto libre: nombre del evento, artistas del line-up, ciudad y nombre
  // del lugar — mismo alcance que el buscador de /candidatos en el admin,
  // para que "busca por ciudad o recinto" funcione igual en los dos lados.
  const textFiltered = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) return entries;
    return entries.filter((e) => {
      const venueName = e.festival.venue_id ? venueById.get(e.festival.venue_id)?.name : null;
      const haystack = [e.festival.nombre, e.festival.ciudad, venueName, ...e.lineup.map((l) => l.artista)]
        .filter((v): v is string => Boolean(v))
        .map(normalizeText)
        .join(' | ');
      return haystack.includes(q);
    });
  }, [entries, query, venueById]);

  const filtered = useMemo(() => {
    const hoy = mexicoToday(new Date());
    return textFiltered.filter((e) => {
      if (ciudad && e.festival.ciudad !== ciudad) return false;
      if (estadoRepublica && venueById.get(e.festival.venue_id ?? '')?.state !== estadoRepublica) return false;
      if (soloDescuento && !descuentoVigente(e.festival, hoy)) return false;
      if (soloPreventa && preventaVigente(e.festival, hoy) === null) return false;
      if (tipoFilter !== 'todos' && e.festival.tipo !== tipoFilter) return false;
      if (!matchesDateFilter(e.festival.fecha_inicio, dateFilter)) return false;
      if (soloMisGeneros && generoMatchArtists) {
        const names = e.lineup.map((l) => normalizeText(l.artista));
        if (!names.some((n) => generoMatchArtists.has(n))) return false;
      }
      return true;
    });
  }, [
    textFiltered,
    ciudad,
    estadoRepublica,
    venueById,
    tipoFilter,
    dateFilter,
    soloMisGeneros,
    generoMatchArtists,
    soloDescuento,
    soloPreventa,
  ]);

  const runGenreMatch = async () => {
    if (misGeneros.length === 0) return;
    setGeneroLoading(true);
    try {
      const allNames = [...new Set(textFiltered.flatMap((e) => e.lineup.map((l) => l.artista)))];
      const { matches } = await fetchFestivalPersonalization(misGeneros, allNames);
      setGeneroMatchArtists(new Set(matches.map((m) => normalizeText(m.artista))));
    } catch {
      // Best-effort — si Spotify falla, el toggle simplemente no filtra nada
      // (queda como si no hubiera match), no se rompe el resto de la lista.
      setGeneroMatchArtists(new Set());
    } finally {
      setGeneroLoading(false);
    }
  };

  const toggleSoloMisGeneros = () => {
    const next = !soloMisGeneros;
    setSoloMisGeneros(next);
    if (next && !generoMatchArtists) runGenreMatch();
  };

  return {
    query,
    setQuery,
    ciudad,
    setCiudad,
    ciudades,
    estadoRepublica,
    setEstadoRepublica,
    estadosRepublica,
    dateFilter,
    setDateFilter,
    tipoFilter,
    setTipoFilter,
    soloMisGeneros,
    toggleSoloMisGeneros,
    soloDescuento,
    toggleSoloDescuento: () => setSoloDescuento((v) => !v),
    soloPreventa,
    toggleSoloPreventa: () => setSoloPreventa((v) => !v),
    promoCounts,
    generoLoading,
    filtered,
  };
}
