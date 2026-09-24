import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { ArtistasList, type ArtistRow } from './artistas-list';

export default async function ArtistasPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: artists, error }, { data: lineup }] = await Promise.all([
    fetchAllRows<{ id: string; name: string; genres: string[] | null; genre_other: string | null }>((from, to) =>
      supabase.from('artists').select('id, name, genres, genre_other').order('name').range(from, to),
    ),
    fetchAllRows<{ artist_id: string | null }>((from, to) =>
      supabase.from('festival_lineup').select('artist_id').not('artist_id', 'is', null).range(from, to),
    ),
  ]);

  const eventsByArtist = new Map<string, number>();
  for (const l of lineup) if (l.artist_id) eventsByArtist.set(l.artist_id, (eventsByArtist.get(l.artist_id) ?? 0) + 1);

  const rows: ArtistRow[] = artists.map((a) => ({ ...a, eventos: eventsByArtist.get(a.id) ?? 0 }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Artistas y género</h1>
        <Link href="/admin" className="text-sm underline">
          ← Festivales
        </Link>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Asigna uno o más géneros a cada artista (se guarda al instante). Se cura a mano a propósito: ninguna fuente
        automática rellena esto, y por ahora no afecta filtros ni &quot;Para ti&quot; en la app.
      </p>
      {error && <p className="mb-4 text-sm text-red-600">No se pudieron cargar los artistas: {error}</p>}
      <ArtistasList artists={rows} />
    </main>
  );
}
