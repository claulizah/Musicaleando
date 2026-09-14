import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { LineupImporter } from './lineup-importer';
import { LineupImageImporter } from './lineup-image-importer';
import type { LineupCandidate } from './actions';
import { LinkBoletosForm } from './link-boletos-form';
import { DeleteLineupRowButton } from './delete-lineup-row-button';
import { AnnouncementForm } from './announcement-form';
import { DeleteAnnouncementButton } from './delete-announcement-button';
import { SelectWinnerButton } from './select-winner-button';
import { MapUploader } from './map-uploader';

const TIPO_LABEL: Record<string, string> = {
  simple: '📣 Anuncio',
  rifa: '🎟️ Rifa',
  descuento: '💸 Descuento',
};

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
    .select('id, nombre, ciudad, fecha_inicio, fecha_fin, link_boletos, mapa_url')
    .eq('id', id)
    .maybeSingle();

  if (!festival) notFound();

  const { data: lineup } = await supabase
    .from('festival_lineup')
    .select('id, artista, escenario, horario')
    .eq('festival_id', id)
    .order('horario', { ascending: true, nullsFirst: false });

  const { data: announcements } = await supabase
    .from('announcements')
    .select(
      'id, tipo, titulo, descripcion, sponsor_nombre, codigo_descuento, created_at, ganador_user_id, ganador_nombre, target_ciudad, target_genero',
    )
    .eq('festival_id', id)
    .order('created_at', { ascending: false });

  const { data: interestCounts } = announcements && announcements.length > 0
    ? await supabase
        .from('announcement_interest')
        .select('announcement_id')
        .in('announcement_id', announcements.map((a) => a.id))
    : { data: [] as { announcement_id: string }[] };

  const { data: sponsors } = await supabase.from('sponsors').select('nombre').order('nombre');

  const { data: lineupCandidates } = await supabase
    .from('festival_lineup_candidates')
    .select('id, batch_id, dia_label, escenario, artista, hora_inicio, hora_fin, confianza, nota')
    .eq('festival_id', id)
    .order('created_at', { ascending: true });

  const pendingByBatch = Object.values(
    (lineupCandidates ?? []).reduce<
      Record<string, { batchId: string; diaLabel: string | null; candidates: LineupCandidate[] }>
    >((acc, c) => {
      if (!acc[c.batch_id]) acc[c.batch_id] = { batchId: c.batch_id, diaLabel: c.dia_label, candidates: [] };
      acc[c.batch_id].candidates.push(c);
      return acc;
    }, {}),
  );

  const { data: mapPins } = await supabase
    .from('festival_map_pins')
    .select('id, escenario, x_pct, y_pct')
    .eq('festival_id', id)
    .order('created_at');

  const escenarios = [...new Set((lineup ?? []).map((l) => l.escenario).filter((e): e is string => !!e))];

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

        <div className="mt-4">
          <LineupImageImporter
            festivalId={festival.id}
            fechaInicio={festival.fecha_inicio}
            pendingByBatch={pendingByBatch}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-medium">Anuncios y promociones ({announcements?.length ?? 0})</h2>
        <p className="mb-3 text-xs text-gray-500">
          Dashboard de interés agregado (comparar entre anuncios/festivales) sigue fuera de
          alcance — aquí se publican/borran anuncios, se ve el conteo de &quot;me interesa&quot;
          por anuncio, y para rifas se puede elegir un ganador al azar entre los interesados.
        </p>
        <ul className="mb-4 flex flex-col gap-2">
          {announcements?.map((a) => {
            const interest = (interestCounts ?? []).filter((i) => i.announcement_id === a.id).length;
            return (
              <li
                key={a.id}
                className="flex items-start justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <div>
                  <p>
                    <span className="font-medium">{TIPO_LABEL[a.tipo] ?? a.tipo}</span>{' '}
                    {a.titulo}
                  </p>
                  {a.descripcion && <p className="text-gray-500">{a.descripcion}</p>}
                  <p className="text-xs text-gray-400">
                    {a.sponsor_nombre && `${a.sponsor_nombre} · `}
                    {a.tipo === 'descuento' && a.codigo_descuento && `código: ${a.codigo_descuento} · `}
                    {interest} interesado{interest === 1 ? '' : 's'}
                    {(a.target_ciudad || a.target_genero) &&
                      ` · segmentado: ${[a.target_ciudad, a.target_genero].filter(Boolean).join(' · ')}`}
                  </p>
                  {a.tipo === 'rifa' && (
                    a.ganador_nombre ? (
                      <p className="text-xs font-medium text-green-700">🎉 Ganador: {a.ganador_nombre}</p>
                    ) : (
                      <SelectWinnerButton
                        festivalId={festival.id}
                        announcementId={a.id}
                        interestCount={interest}
                      />
                    )
                  )}
                </div>
                <DeleteAnnouncementButton festivalId={festival.id} announcementId={a.id} />
              </li>
            );
          })}
          {announcements?.length === 0 && (
            <p className="text-sm text-gray-500">Todavía no hay anuncios para este festival.</p>
          )}
        </ul>

        <AnnouncementForm festivalId={festival.id} sponsorNames={(sponsors ?? []).map((s) => s.nombre)} />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 font-medium">Mapa del festival</h2>
        <MapUploader
          festivalId={festival.id}
          mapaUrl={festival.mapa_url}
          pins={mapPins ?? []}
          escenarios={escenarios}
        />
      </section>
    </main>
  );
}
