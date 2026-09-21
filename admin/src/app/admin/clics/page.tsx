import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { buildReport, type ClickRow } from '@/lib/ticketClicksReport';
import { AffiliateTemplateForm } from './affiliate-template-form';

const PLATFORM_LABEL: Record<string, string> = {
  ticketmaster: 'Ticketmaster',
  frontgate: 'Front Gate',
  eticket: 'Eticket',
  superboletos: 'Superboletos',
  otro: 'Otra',
};

const WEEKS_BACK = 6;

export default async function ClicsPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const since = new Date(new Date().getTime() - (WEEKS_BACK * 7 + 7) * 86_400_000).toISOString();

  const rows: ClickRow[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await supabase
      .from('ticket_clicks')
      .select('festival_id, plataforma, afiliado, created_at')
      .gte('created_at', since)
      .neq('plataforma', 'prueba-automatica')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const report = buildReport(rows, WEEKS_BACK);

  const ids = report.byEvent.map((e) => e.festival_id).filter((id): id is string => Boolean(id)).slice(0, 40);
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await supabase.from('festivals').select('id, nombre').in('id', ids);
    for (const f of data ?? []) names.set(f.id, f.nombre);
  }

  const { data: cfg } = await supabase.from('app_config').select('value').eq('key', 'affiliate_url_template').maybeSingle();

  const fmtWeek = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clics en &quot;Comprar boletos&quot;</h1>
        <Link href="/admin" className="text-sm underline">
          ← Festivales
        </Link>
      </div>

      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-medium">Link de afiliado</h2>
        <p className="mb-3 mt-1 text-xs text-gray-500">
          Cuando te aprueben como afiliada (Impact), pega aquí la plantilla de tu link con <code>{'{url}'}</code> donde
          va el link original del evento. Aplica solo a Ticketmaster; los demás links no se tocan. Vacío = sin afiliado.
          Estado actual:{' '}
          <strong>{cfg?.value ? 'activa' : 'sin plantilla (los links se abren tal cual)'}</strong>.
        </p>
        <AffiliateTemplateForm initialValue={cfg?.value ?? ''} />
      </section>

      <div className="mb-6 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-2xl font-semibold">{report.last7}</p>
          <p className="text-xs text-gray-500">últimos 7 días</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-2xl font-semibold">{report.last30}</p>
          <p className="text-xs text-gray-500">últimos 30 días</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-2xl font-semibold">{report.total}</p>
          <p className="text-xs text-gray-500">en el periodo del reporte</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Por plataforma</h2>
        {report.byPlatform.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay clics registrados.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {report.byPlatform.map((p) => (
              <li key={p.plataforma} className="flex justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                <span>{PLATFORM_LABEL[p.plataforma] ?? p.plataforma}</span>
                <span className="text-gray-500">
                  {p.total} clic{p.total === 1 ? '' : 's'} · {p.conAfiliado} con afiliado
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Por evento y semana (lunes a domingo)</h2>
        {report.byEvent.length === 0 ? (
          <p className="text-sm text-gray-500">Sin datos todavía.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2">Evento</th>
                  {report.weeks.map((w) => (
                    <th key={w} className="px-2 py-2 text-right">
                      {fmtWeek(w)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.byEvent.slice(0, 40).map((e) => (
                  <tr key={e.festival_id ?? 'borrado'} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      {e.festival_id ? (
                        <Link href={`/festivals/${e.festival_id}`} className="underline">
                          {names.get(e.festival_id) ?? e.festival_id}
                        </Link>
                      ) : (
                        <span className="text-gray-400">(evento ya borrado)</span>
                      )}
                    </td>
                    {e.perWeek.map((n, i) => (
                      <td key={i} className="px-2 py-2 text-right text-gray-600">
                        {n || '·'}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-medium">{e.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
