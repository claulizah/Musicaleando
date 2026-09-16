import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { CandidateActions } from './candidate-actions';

const ESTADO_LABEL: Record<string, string> = {
  cancelado: 'Cancelado en la fuente',
  desaparecido: 'Desaparecido de la fuente',
};

const SOURCE_LABEL: Record<string, string> = {
  ticketmaster: 'Ticketmaster',
  poster_image: '📷 Póster (admin)',
  sumision_publica: '🌐 Sumisión pública',
  link: '🔗 Link',
};

const TIPO_LABEL: Record<string, string> = {
  festival: '🎪 Festival',
  concierto: '🎤 Concierto',
};

function formatLineupItem(item: string | { artista: string; escenario: string | null; horario: string | null }): string {
  if (typeof item === 'string') return item;
  const parts = [item.artista];
  if (item.escenario) parts.push(item.escenario);
  if (item.horario) parts.push(item.horario);
  return parts.join(' · ');
}

function rawPayloadExtras(raw: unknown): { submittedLink: string | null; posterUrl: string | null } {
  if (!raw || typeof raw !== 'object') return { submittedLink: null, posterUrl: null };
  const obj = raw as Record<string, unknown>;
  return {
    submittedLink: typeof obj.submitted_link === 'string' ? obj.submitted_link : null,
    posterUrl: typeof obj.poster_url === 'string' ? obj.poster_url : null,
  };
}

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

  const [{ data: pending }, { data: flagged }, { data: festivals }] = await Promise.all([
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
        <Link href="/admin" className="text-sm underline">
          ← Festivales
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {(pending ?? []).map((c) => {
          const duplicateName = c.possible_duplicate_of ? festivalNameById.get(c.possible_duplicate_of) : null;
          const { submittedLink, posterUrl } = rawPayloadExtras(c.raw_payload);
          return (
            <li key={c.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{c.nombre}</p>
                    {c.tipo && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {TIPO_LABEL[c.tipo] ?? c.tipo}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {c.ciudad ?? 'Sin ciudad'} · {c.fecha_inicio ?? 'Sin fecha'}
                    {c.venue ? ` · ${c.venue}` : ''}
                  </p>
                  <p className="text-xs text-gray-400">Fuente: {SOURCE_LABEL[c.source] ?? c.source}</p>
                  {posterUrl && (
                    <a href={posterUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                      Ver póster adjunto
                    </a>
                  )}
                  {submittedLink && (
                    <p className="text-xs text-gray-400">
                      Link de la fuente:{' '}
                      <a href={submittedLink} target="_blank" rel="noreferrer" className="underline">
                        {submittedLink}
                      </a>
                    </p>
                  )}
                  {c.price_min != null && (
                    <p className="text-xs text-gray-400">
                      Desde {c.price_min} {c.price_currency ?? ''}
                      {c.price_max != null ? ` hasta ${c.price_max}` : ''}
                    </p>
                  )}
                  {Array.isArray(c.lineup) && c.lineup.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Line-up: {c.lineup.slice(0, 6).map(formatLineupItem).join(', ')}
                      {c.lineup.length > 6 ? '…' : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.completo ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {c.completo ? 'Completo' : 'Incompleto'}
                  </span>
                  {c.link_boletos && (
                    <a href={c.link_boletos} target="_blank" rel="noreferrer" className="text-xs underline">
                      Ver boletos
                    </a>
                  )}
                </div>
              </div>

              {duplicateName && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Posible duplicado de un festival ya cargado: <strong>{duplicateName}</strong>. Revisa antes de
                  aprobar — no se fusiona automáticamente.
                </p>
              )}

              <CandidateActions
                candidateId={c.id}
                completo={c.completo}
                defaults={{
                  nombre: c.nombre,
                  tipo: c.tipo ?? '',
                  ciudad: c.ciudad ?? '',
                  fecha_inicio: c.fecha_inicio ?? '',
                  fecha_fin: c.fecha_fin ?? '',
                  link_boletos: c.link_boletos ?? '',
                }}
              />
            </li>
          );
        })}
        {(pending ?? []).length === 0 && (
          <p className="text-sm text-gray-500">No hay candidatos pendientes.</p>
        )}
      </ul>

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
