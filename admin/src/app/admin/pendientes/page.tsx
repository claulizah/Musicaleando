import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

// Bandeja unificada — junta en un solo lugar los dos tipos de pendientes que
// hoy viven en pantallas separadas (candidatos de eventos en /candidatos,
// canciones de mood_playlists en /mood). No reemplaza ninguna de las dos:
// es solo un resumen con conteos y acceso directo a cada cola, que es lo
// mínimo que resuelve "ver todo lo que falta por revisar en un solo lugar"
// sin duplicar la UI de aprobar/descartar que ya existe en cada una.
export default async function PendientesPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ count: eventCount }, { data: moods }, { data: pendingSongs }] = await Promise.all([
    supabase.from('event_candidates').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    supabase.from('mood_catalog').select('id, label, emoji'),
    supabase.from('mood_playlists').select('mood_id').eq('estado', 'pendiente'),
  ]);

  const moodLabelById = new Map((moods ?? []).map((m) => [m.id, `${m.emoji} ${m.label}`]));
  const songCountByMood = new Map<string, number>();
  for (const row of pendingSongs ?? []) {
    songCountByMood.set(row.mood_id, (songCountByMood.get(row.mood_id) ?? 0) + 1);
  }
  const totalSongsPending = pendingSongs?.length ?? 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pendientes</h1>
        <Link href="/admin" className="text-sm underline">
          ← Festivales
        </Link>
      </div>
      <p className="mb-6 text-sm text-gray-500">Todo lo que falta por revisar, en un solo lugar.</p>

      <div className="flex flex-col gap-4">
        <Link
          href="/candidatos"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50"
        >
          <div>
            <p className="font-medium">Candidatos de eventos</p>
            <p className="text-sm text-gray-500">Ticketmaster, imagen/link, sumisión pública.</p>
          </div>
          <span className="rounded-full bg-black px-3 py-1 text-sm text-white">{eventCount ?? 0}</span>
        </Link>

        <Link
          href="/mood"
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50"
        >
          <div>
            <p className="font-medium">Canciones pendientes (Mood playlists)</p>
            <p className="text-sm text-gray-500">
              {totalSongsPending === 0
                ? 'Sin candidatas pendientes.'
                : [...songCountByMood.entries()]
                    .map(([id, n]) => `${moodLabelById.get(id) ?? id}: ${n}`)
                    .join(' · ')}
            </p>
          </div>
          <span className="rounded-full bg-black px-3 py-1 text-sm text-white">{totalSongsPending}</span>
        </Link>
      </div>
    </main>
  );
}
