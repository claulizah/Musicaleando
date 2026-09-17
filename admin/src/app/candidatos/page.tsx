import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { CandidatosList } from './candidatos-list';
import { RepublishSiteButton } from './republish-site-button';
import { getLastSiteDeploy } from './deploy-actions';

const ESTADO_LABEL: Record<string, string> = {
  cancelado: 'Cancelado en la fuente',
  desaparecido: 'Desaparecido de la fuente',
};

export default async function CandidatosPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();

  const [{ data: pending }, { data: flagged }, { data: festivals }, { lastTriggeredAt }] = await Promise.all([
    supabase
      .from('event_candidates')
      .select('*')
      .eq('estado', 'pendiente')
      .order('fecha_inicio', { ascending: true, nullsFirst: false }),
    supabase
      .from('event_candidates')
      .select('id, nombre, ciudad, fecha_inicio, estado')
      .in('estado', ['cancelado', 'desaparecido'])
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase.from('festivals').select('id, nombre'),
    getLastSiteDeploy(),
  ]);

  const festivalNameById = new Map((festivals ?? []).map((f) => [f.id, f.nombre]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Candidatos de eventos</h1>
          <p className="mt-1 text-sm text-gray-500">
            De Ticketmaster, imagen/link agregados desde el panel, o sugerencias públicas. Nada se
            publica sin tu aprobación.
          </p>
        </div>
        <div className="flex items-start gap-4">
          <RepublishSiteButton initialLastTriggeredAt={lastTriggeredAt} />
          <Link href="/candidatos/limpieza" className="text-sm underline">
            Limpiar nombres
          </Link>
          <Link href="/candidatos/reparar-lineup" className="text-sm underline">
            Reparar line-up
          </Link>
          <Link href="/admin" className="text-sm underline">
            ← Festivales
          </Link>
        </div>
      </div>

      <CandidatosList candidates={pending ?? []} festivalNameById={festivalNameById} />

      {(flagged ?? []).length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-gray-700">Marcados por la fuente (no accionables)</h2>
          <p className="mt-1 text-xs text-gray-500">
            Ticketmaster los reportó cancelados, o llevan varios syncs sin aparecer. Nunca se borran solos.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {(flagged ?? []).map((c) => (
              <li key={c.id} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-700">{c.nombre}</span>
                <span className="text-gray-400"> · {c.ciudad ?? 'Sin ciudad'} · {c.fecha_inicio ?? 'Sin fecha'} · </span>
                <span className="text-xs text-gray-500">{ESTADO_LABEL[c.estado] ?? c.estado}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
