import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NOVEDAD_PANTALLAS } from '@/lib/novedades';
import { NovedadForm } from './novedad-form';
import { NovedadRowActions } from './row-actions';

export default async function NovedadesPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: novedades, error } = await supabase
    .from('novedades')
    .select('id, pantalla, titulo, cuerpo, publicada_en, vigente_hasta, activa')
    .order('publicada_en', { ascending: false });

  const now = new Date().getTime();
  const labelOf = (id: string) => NOVEDAD_PANTALLAS.find((p) => p.id === id)?.label ?? id;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Novedades (avisos de &quot;Nuevo&quot;)</h1>
        <Link href="/admin" className="text-sm underline">
          ← Festivales
        </Link>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        Un aviso aparece una sola vez por usuario, arriba de la pantalla elegida, hasta que lo cierra o pasa su fecha de
        vigencia. Se publican sin release nuevo de la app.
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          No se pudieron cargar los avisos: {error.message}. Si es la primera vez, falta correr la migración{' '}
          <code>novedades_y_metricas</code>.
        </p>
      )}

      <NovedadForm />

      <h2 className="mb-2 mt-8 font-medium">Avisos publicados</h2>
      <ul className="flex flex-col gap-2">
        {(novedades ?? []).map((n) => {
          const vencida = n.vigente_hasta ? new Date(n.vigente_hasta).getTime() < now : false;
          const estado = !n.activa ? 'pausado' : vencida ? 'vencido' : 'visible';
          return (
            <li key={n.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div>
                <p className="font-medium">
                  {n.titulo}{' '}
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                      estado === 'visible' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {estado}
                  </span>
                </p>
                <p className="text-gray-600">{n.cuerpo}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {labelOf(n.pantalla)} · <code>{n.id}</code>
                  {n.vigente_hasta ? ` · hasta ${new Date(n.vigente_hasta).toLocaleDateString('es-MX')}` : ' · sin vigencia'}
                </p>
              </div>
              <NovedadRowActions id={n.id} activa={n.activa} />
            </li>
          );
        })}
        {(novedades ?? []).length === 0 && <p className="text-sm text-gray-500">Todavía no hay avisos.</p>}
      </ul>
    </main>
  );
}
