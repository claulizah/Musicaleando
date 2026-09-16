import Link from 'next/link';
import type { Metadata } from 'next';

// Mismas URL/anon key públicas que ya usa la app móvil y /sugerir-evento
// (Supabase publishable key, protegida por RLS del lado del servidor). Este
// sitio es un export estático (next.config.ts: output: "export"), así que
// esta página se genera en build time con fetch directo al REST de
// PostgREST — no hay server actions ni supabase-js aquí. Una consecuencia
// real de esto: un artista nuevo/actualizado solo aparece después del
// siguiente build+deploy del sitio, igual que el resto del sitio estático.
const SUPABASE_URL = 'https://ijwyykfuyeaahvxmaild.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l6gO2eL5ILGd9XtthWjibg_gyLETNSs';

type Artist = { id: string; name: string };

type FestivalRef = {
  id: string;
  nombre: string;
  tipo: string;
  ciudad: string;
  fecha_inicio: string;
  fecha_fin: string;
  link_boletos: string | null;
};

// El shape de esta consulta (festival_lineup embebiendo festivals, filtrado
// por artist_id) es la misma "lógica de armar la lista de apariciones" que
// usa la app móvil (ver src/screens/main/ArtistDetailScreen.tsx) — ahí se
// deriva del mismo join sobre datos ya cargados por useFestivalStore; aquí
// se pide el mismo join directo a PostgREST porque el sitio no comparte
// runtime/paquetes con la app (Expo/RN) ni con el panel (Next server). No
// existe hoy un mecanismo de código compartido entre los tres proyectos de
// este repo, así que duplicar el *shape* de esta única query (no la lógica
// de armado en sí, que aquí es un simple sort) es el patrón más simple.
type Appearance = { id: string; festivals: FestivalRef | null };

async function fetchArtist(id: string): Promise<Artist | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artists?id=eq.${id}&select=id,name`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Artist[];
  return rows[0] ?? null;
}

async function fetchAppearances(id: string): Promise<Appearance[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/festival_lineup?artist_id=eq.${id}&select=id,festivals(id,nombre,tipo,ciudad,fecha_inicio,fecha_fin,link_boletos)`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
  );
  if (!res.ok) return [];
  return (await res.json()) as Appearance[];
}

export async function generateStaticParams() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/artists?select=id`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as { id: string }[];
  return rows.map((r) => ({ id: r.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const artist = await fetchArtist(id);
  const title = artist ? `${artist.name} — Musicaleando` : 'Artista — Musicaleando';
  const description = artist
    ? `Todos los festivales y conciertos de ${artist.name} en Musicaleando, en un solo lugar.`
    : 'Encuentra todos los festivales y conciertos de tus artistas favoritos en Musicaleando.';
  return { title, description, openGraph: { title, description } };
}

function formatRange(inicio: string, fin: string): string {
  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  return inicio === fin ? fmt(inicio) : `${fmt(inicio)} – ${fmt(fin)}`;
}

const TIPO_LABEL: Record<string, string> = {
  festival: '🎪 Festival',
  concierto: '🎤 Concierto',
};

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, appearances] = await Promise.all([fetchArtist(id), fetchAppearances(id)]);

  if (!artist) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Artista no encontrado</h1>
        <p className="mt-4 text-sm">
          <Link href="/" className="underline">
            ← Volver al inicio
          </Link>
        </p>
      </main>
    );
  }

  const sorted = appearances
    .filter((a): a is { id: string; festivals: FestivalRef } => a.festivals !== null)
    .sort((a, b) => a.festivals.fecha_inicio.localeCompare(b.festivals.fecha_inicio));

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-gray-500 underline">
        ← Musicaleando
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{artist.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {sorted.length > 0 ? `${sorted.length} evento${sorted.length === 1 ? '' : 's'} en Musicaleando` : 'Sin eventos próximos por ahora'}
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {sorted.map((a) => (
          <li key={a.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{a.festivals.nombre}</span>
              <span className="text-xs text-gray-500">{TIPO_LABEL[a.festivals.tipo] ?? '🎪 Festival'}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {a.festivals.ciudad} · {formatRange(a.festivals.fecha_inicio, a.festivals.fecha_fin)}
            </p>
            {a.festivals.link_boletos && (
              <a
                href={a.festivals.link_boletos}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-blue-600 underline"
              >
                Ver boletos ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
