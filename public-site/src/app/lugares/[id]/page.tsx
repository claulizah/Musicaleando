import Link from 'next/link';
import type { Metadata } from 'next';

// Mismo patrón que /artistas/[id] (ver ese archivo para el porqué de pedir
// directo a PostgREST en vez de supabase-js/server actions: este sitio es un
// export estático). Un lugar/venue nuevo o actualizado solo aparece después
// del siguiente build+deploy, igual que el resto del sitio.
const SUPABASE_URL = 'https://ijwyykfuyeaahvxmaild.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l6gO2eL5ILGd9XtthWjibg_gyLETNSs';

type Venue = { id: string; name: string; city: string; state: string };

type FestivalRef = {
  id: string;
  nombre: string;
  tipo: string;
  ciudad: string;
  fecha_inicio: string;
  fecha_fin: string;
  link_boletos: string | null;
};

async function fetchVenue(id: string): Promise<Venue | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/venues?id=eq.${id}&select=id,name,city,state`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Venue[];
  return rows[0] ?? null;
}

async function fetchEvents(id: string): Promise<FestivalRef[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/festivals?venue_id=eq.${id}&estado_evento=eq.activo&select=id,nombre,tipo,ciudad,fecha_inicio,fecha_fin,link_boletos&order=fecha_inicio.asc`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
  );
  if (!res.ok) return [];
  return (await res.json()) as FestivalRef[];
}

export async function generateStaticParams() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/venues?select=id`, {
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
  const venue = await fetchVenue(id);
  const title = venue ? `${venue.name} — Musicaleando` : 'Lugar — Musicaleando';
  const description = venue
    ? `Todos los festivales y conciertos en ${venue.name} (${venue.city}, ${venue.state}) en Musicaleando.`
    : 'Encuentra todos los festivales y conciertos por lugar en Musicaleando.';
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

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [venue, events] = await Promise.all([fetchVenue(id), fetchEvents(id)]);

  if (!venue) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Lugar no encontrado</h1>
        <p className="mt-4 text-sm">
          <Link href="/" className="underline">
            ← Volver al inicio
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-gray-500 underline">
        ← Musicaleando
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{venue.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {venue.city} · {venue.state}
      </p>
      <p className="mt-1 text-sm text-gray-500">
        {events.length > 0 ? `${events.length} evento${events.length === 1 ? '' : 's'} en Musicaleando` : 'Sin eventos próximos por ahora'}
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {events.map((f) => (
          <li key={f.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{f.nombre}</span>
              <span className="text-xs text-gray-500">{TIPO_LABEL[f.tipo] ?? '🎪 Festival'}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {f.ciudad} · {formatRange(f.fecha_inicio, f.fecha_fin)}
            </p>
            {f.link_boletos && (
              <a
                href={f.link_boletos}
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
