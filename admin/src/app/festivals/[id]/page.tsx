import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { LineupImporter } from './lineup-importer';
import { LinkBoletosForm } from './link-boletos-form';
import { DeleteLineupRowButton } from './delete-lineup-row-button';

export default async function FestivalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: festival } = await supabase
    .from('festivals')
    .select('id, nombre, ciudad, fecha_inicio, fecha_fin, link_boletos')
    .eq('id', id)
    .maybeSingle();

  if (!festival) notFound();

  const { data: lineup } = await supabase
    .from('festival_lineup')
    .select('id, artista, escenario, horario')
    .eq('festival_id', id)
    .order('horario', { ascending: true, nullsFirst: false });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">{festival.nombre}</h1>
      <p className="text-sm text-gray-500">
        {festival.ciudad} · {festival.fecha_inicio} → {festival.fecha_fin}
      </p>

      <section className="mt-8">
        <h2 className="mb-2 font-medium">Boletos</h2>
        <LinkBoletosForm festivalId={festival.id} initialLink={festival.link_boletos ?? ''} />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-medium">Line-up ({lineup?.length ?? 0})</h2>
        <ul className="mb-4 flex flex-col gap-2">
          {lineup?.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{row.artista}</span>
                {row.escenario && <span className="text-gray-500"> · {row.escenario}</span>}
                {row.horario && (
                  <span className="text-gray-400">
                    {' '}
                    · {new Date(row.horario).toLocaleString('es-MX')}
                  </span>
                )}
              </span>
              <DeleteLineupRowButton festivalId={festival.id} rowId={row.id} />
            </li>
          ))}
          {lineup?.length === 0 && (
            <p className="text-sm text-gray-500">Todavía no hay artistas cargados.</p>
          )}
        </ul>

        <LineupImporter festivalId={festival.id} />
      </section>
    </main>
  );
}
