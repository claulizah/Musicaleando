import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { FestivalesList } from './festivales-list';

export default async function DashboardPage() {
  const admin = await requireAdmin();

  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
        <p className="mt-2 text-sm text-gray-500">
          Tu cuenta ({admin.email}) no tiene permisos de administrador todavía. Pide a alguien
          con acceso que marque tu usuario como admin.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: festivals }, { count: eventPendingCount }, { count: songPendingCount }, { data: venues }, { data: approvedCandidates }] =
    await Promise.all([
      supabase
        .from('festivals')
        .select('id, nombre, tipo, ciudad, fecha_inicio, fecha_fin, link_boletos, estado_evento, venue_id')
        .order('fecha_inicio', { ascending: true }),
      supabase.from('event_candidates').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('mood_playlists').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('venues').select('id, name'),
      // Fuente de origen de cada festival aprobado — event_candidates es la
      // única tabla que guarda esto (festivals no tiene columna `source`);
      // ver scripts/generate-venues-backfill.mts para el mismo criterio.
      supabase.from('event_candidates').select('festival_id, source').not('festival_id', 'is', null),
    ]);
  const venueNameById = Object.fromEntries((venues ?? []).map((v) => [v.id, v.name]));
  const sourceByFestival = Object.fromEntries(
    (approvedCandidates ?? []).filter((c) => c.festival_id).map((c) => [c.festival_id as string, c.source]),
  );

  // festival_lineup ya tiene 1400+ filas (más que el límite de 1000 filas
  // por página que aplica PostgREST por default) — se pagina explícito para
  // no perder artistas de festivales que quedaron en páginas después de la
  // primera al armar el índice de búsqueda por artista.
  const lineupByFestival = new Map<string, string[]>();
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page } = await supabase
      .from('festival_lineup')
      .select('festival_id, artista')
      .range(from, from + PAGE_SIZE - 1);
    for (const row of page ?? []) {
      if (!lineupByFestival.has(row.festival_id)) lineupByFestival.set(row.festival_id, []);
      lineupByFestival.get(row.festival_id)!.push(row.artista);
    }
    if (!page || page.length < PAGE_SIZE) break;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Festivales</h1>
        <div className="flex items-center gap-3">
          <Link href="/sponsors" className="text-sm underline">
            Patrocinadores
          </Link>
          <Link href="/insights" className="text-sm underline">
            Sound Insights
          </Link>
          <Link href="/moderacion" className="text-sm underline">
            Moderación
          </Link>
          <Link href="/admin/pendientes" className="text-sm underline">
            Pendientes
          </Link>
          <Link href="/candidatos" className="text-sm underline">
            Candidatos
          </Link>
          <Link href="/admin/calendario" className="text-sm underline">
            Calendario
          </Link>
          <Link href="/mood" className="text-sm underline">
            Mood playlists
          </Link>
          <Link
            href="/festivals/new"
            className="rounded-md bg-black px-3 py-2 text-sm text-white"
          >
            + Nuevo festival
          </Link>
        </div>
      </div>

      {/* Resumen + acciones rápidas — punto de entrada consolidado. Enlaza a
          /admin/pendientes y /admin/calendario (ya construidos en otros
          tickets) en vez de reconstruir esas vistas aquí; el buscador ya
          vive en FestivalesList justo debajo, tampoco se duplica. */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/pendientes"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50"
        >
          <div>
            <p className="font-medium">Pendientes de revisión</p>
            <p className="text-sm text-gray-500">
              {eventPendingCount ?? 0} candidato{eventPendingCount === 1 ? '' : 's'} de eventos ·{' '}
              {songPendingCount ?? 0} canción{songPendingCount === 1 ? '' : 'es'}
            </p>
          </div>
          <span className="rounded-full bg-black px-3 py-1 text-sm text-white">
            {(eventPendingCount ?? 0) + (songPendingCount ?? 0)}
          </span>
        </Link>

        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <p className="font-medium">Acciones rápidas</p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/festivals/new" className="rounded-md bg-black px-3 py-1.5 text-white">
              + Evento
            </Link>
            <Link href="/mood" className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-700">
              + Canción
            </Link>
            <Link href="/festivals/importar" className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-700">
              ⬆ Importar CSV
            </Link>
            <Link href="/admin/clics" className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-700">
              🎟 Clics de compra
            </Link>
            <Link href="/admin/descuentos" className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-700">
              🏷 Descuentos
            </Link>
            <Link href="/admin/metricas" className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-700">
              📊 Métricas
            </Link>
            <Link href="/admin/novedades" className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-700">
              ✨ Novedades
            </Link>
            <Link href="/admin/calendario" className="rounded-md bg-gray-100 px-3 py-1.5 text-gray-700">
              📅 Calendario
            </Link>
          </div>
        </div>
      </div>

      <FestivalesList
        festivals={festivals ?? []}
        lineupByFestival={Object.fromEntries(lineupByFestival)}
        venueNameById={venueNameById}
        sourceByFestival={sourceByFestival}
      />
    </main>
  );
}
