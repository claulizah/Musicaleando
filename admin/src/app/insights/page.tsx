import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

const TIPO_LABEL: Record<string, string> = {
  simple: '📣 Anuncio',
  rifa: '🎟️ Rifa',
  descuento: '💸 Descuento',
};

const MIN_USUARIOS = 30;

export default async function InsightsPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();

  // Dashboard de interés agregado: cada anuncio ya se veía en su propio
  // festival — esto los junta todos, ordenados por interés, para comparar
  // entre festivales/patrocinadores de un vistazo.
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, tipo, titulo, sponsor_nombre, festival_id, ganador_nombre')
    .order('created_at', { ascending: false });

  const { data: festivals } = await supabase.from('festivals').select('id, nombre');
  const festivalNameById = new Map((festivals ?? []).map((f) => [f.id, f.nombre]));

  const { data: interestRows } = await supabase.from('announcement_interest').select('announcement_id');
  const interestCountById = new Map<string, number>();
  for (const row of interestRows ?? []) {
    interestCountById.set(row.announcement_id, (interestCountById.get(row.announcement_id) ?? 0) + 1);
  }

  const ranked = (announcements ?? [])
    .map((a) => ({ ...a, interest: interestCountById.get(a.id) ?? 0 }))
    .sort((a, b) => b.interest - a.interest);

  // Tendencias por segmento de arquetipo: agregado real, gated server-side
  // en la propia función (nunca vuelve nada por debajo de MIN_USUARIOS, ni
  // siquiera al admin) — la regla de cumplimiento del spec se aplica en la
  // base de datos, no solo en esta pantalla.
  const { data: profileCount } = await supabase.rpc('insights_profile_count');
  const { data: arquetipoGeneros } = await supabase.rpc('insights_arquetipo_generos', {
    p_min_usuarios: MIN_USUARIOS,
  });

  const byArquetipo = new Map<string, { genero: string; usuarios: number }[]>();
  for (const row of arquetipoGeneros ?? []) {
    const list = byArquetipo.get(row.arquetipo) ?? [];
    list.push({ genero: row.genero, usuarios: row.usuarios });
    byArquetipo.set(row.arquetipo, list);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Sound Insights</h1>
      <p className="mt-1 text-sm text-gray-500">
        Reportes agregados para el pitch a marcas/festivales — nunca datos individuales.
      </p>

      <section className="mt-8">
        <h2 className="mb-2 font-medium">Interés por anuncio (todos los festivales)</h2>
        <ul className="flex flex-col gap-2">
          {ranked.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <div>
                <p>
                  <span className="font-medium">{TIPO_LABEL[a.tipo] ?? a.tipo}</span> {a.titulo}
                </p>
                <p className="text-xs text-gray-400">
                  {festivalNameById.get(a.festival_id) ?? 'Festival desconocido'}
                  {a.sponsor_nombre && ` · ${a.sponsor_nombre}`}
                  {a.ganador_nombre && ` · ganador: ${a.ganador_nombre}`}
                </p>
              </div>
              <span className="font-mono text-sm">{a.interest}</span>
            </li>
          ))}
          {ranked.length === 0 && <p className="text-sm text-gray-500">Todavía no hay anuncios.</p>}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-medium">Tendencias por segmento de arquetipo × género</h2>
        {byArquetipo.size === 0 ? (
          <p className="text-sm text-gray-500">
            Todavía no hay suficientes perfiles para este reporte (mínimo {MIN_USUARIOS}, hoy
            hay {profileCount ?? 0}). Es la regla de cumplimiento del spec aplicada — nunca se
            genera un agregado que pudiera identificar a alguien.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from(byArquetipo.entries()).map(([arquetipo, generos]) => (
              <div key={arquetipo} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
                <p className="mb-1 font-medium">{arquetipo}</p>
                <ul className="flex flex-wrap gap-2">
                  {generos.map((g) => (
                    <li key={g.genero} className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                      {g.genero} · {g.usuarios}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
