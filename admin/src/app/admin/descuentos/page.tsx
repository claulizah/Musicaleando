import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import {
  descuentoBadge,
  descuentoVigenciaLabel,
  descuentoVigente,
  mexicoToday,
  preventaVigente,
  type PromoFields,
} from '@/lib/descuentos';
import { BannerForm } from './banner-form';

type FestivalPromo = PromoFields & { id: string; nombre: string; ciudad: string; fecha_inicio: string };

export default async function DescuentosPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: banner }, { data }] = await Promise.all([
    supabase.from('app_config').select('value').eq('key', 'banner_descuentos').maybeSingle(),
    supabase
      .from('festivals')
      .select(
        'id, nombre, ciudad, fecha_inicio, fecha_fin, estado_evento, tipo_descuento, descuento_detalle, descuento_vigente_hasta, preventa_inicio, preventa_fin, preventa_detalle',
      )
      .or('tipo_descuento.not.is.null,preventa_inicio.not.is.null,preventa_detalle.not.is.null')
      .order('fecha_inicio', { ascending: true }),
  ]);

  const hoy = mexicoToday(new Date());
  const festivals = (data ?? []) as FestivalPromo[];
  // Lo que la app muestra hoy vs. lo que quedó capturado pero ya venció o
  // corresponde a un evento pasado/archivado (para que sepas qué limpiar).
  const visibles = festivals.filter((f) => descuentoVigente(f, hoy) || preventaVigente(f, hoy));
  const apagadas = festivals.filter((f) => !descuentoVigente(f, hoy) && !preventaVigente(f, hoy));

  const row = (f: FestivalPromo) => {
    const badge = descuentoBadge(f, hoy);
    const preventa = preventaVigente(f, hoy);
    const vigencia = descuentoVigenciaLabel(f);
    return (
      <li key={f.id} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/festivals/${f.id}`} className="font-medium underline">
            {f.nombre}
          </Link>
          <span className="text-xs text-gray-400">
            {f.ciudad} · {f.fecha_inicio}
          </span>
        </div>
        {f.tipo_descuento && (
          <p className="text-gray-600">
            {badge ? <span className="font-medium text-green-700">{badge}</span> : <span className="text-gray-400">Descuento apagado</span>}
            {f.descuento_detalle && ` · ${f.descuento_detalle}`}
            {vigencia && ` · ${vigencia}`}
          </p>
        )}
        {(f.preventa_inicio || f.preventa_detalle) && (
          <p className="text-gray-600">
            {preventa ? <span className="font-medium text-blue-700">{preventa.label}</span> : <span className="text-gray-400">Preventa apagada</span>}
            {f.preventa_detalle && ` · ${f.preventa_detalle}`}
          </p>
        )}
      </li>
    );
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Descuentos y preventas</h1>
      <p className="text-sm text-gray-500">
        Se capturan en la página de cada evento (sección &quot;Descuento y preventa&quot;). La app los muestra
        mientras estén vigentes y los oculta sola al vencer o pasar el evento.
      </p>

      <section className="mt-8">
        <h2 className="mb-1 font-medium">Banner en la app</h2>
        <p className="mb-3 text-xs text-gray-500">
          Aparece arriba del catálogo de eventos. Útil para promos generales como el 2x1 de los jueves, que depende
          del banco o la tarjeta y varía por evento. Vacío = sin banner.
        </p>
        <BannerForm initialValue={banner?.value ?? ''} />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-medium">Visibles hoy en la app ({visibles.length})</h2>
        {visibles.length === 0 ? (
          <p className="text-sm text-gray-500">Ningún evento tiene un descuento o preventa vigente.</p>
        ) : (
          <ul className="flex flex-col gap-2">{visibles.map(row)}</ul>
        )}
      </section>

      {apagadas.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 font-medium">Vencidos o de eventos que ya pasaron ({apagadas.length})</h2>
          <ul className="flex flex-col gap-2 opacity-70">{apagadas.map(row)}</ul>
        </section>
      )}
    </main>
  );
}
