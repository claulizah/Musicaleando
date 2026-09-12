import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

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
  const { data: festivals } = await supabase
    .from('festivals')
    .select('id, nombre, ciudad, fecha_inicio, fecha_fin, link_boletos')
    .order('fecha_inicio', { ascending: true });

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
      <ul className="flex flex-col gap-3">
        {festivals?.map((f) => (
          <li key={f.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <Link href={`/festivals/${f.id}`} className="font-medium underline">
              {f.nombre}
            </Link>
            <p className="text-sm text-gray-500">
              {f.ciudad} · {f.fecha_inicio} → {f.fecha_fin}
            </p>
            <p className="text-xs text-gray-400">
              {f.link_boletos ? f.link_boletos : 'Sin link de boletos'}
            </p>
          </li>
        ))}
        {festivals?.length === 0 && (
          <p className="text-sm text-gray-500">No hay festivales todavía.</p>
        )}
      </ul>
    </main>
  );
}
