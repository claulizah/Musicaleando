import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { ReportActions } from './report-actions';

const MOTIVO_LABEL: Record<string, string> = {
  spam: 'Spam',
  ofensivo: 'Ofensivo',
  otro: 'Otro',
};

export default async function ModerationPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();

  const { data: reports } = await supabase
    .from('content_reports')
    .select('id, content_type, content_id, motivo, created_at')
    .eq('resuelto', false)
    .order('created_at', { ascending: true });

  const commentIds = (reports ?? [])
    .filter((r) => r.content_type === 'festival_comment')
    .map((r) => r.content_id);
  const shareIds = (reports ?? [])
    .filter((r) => r.content_type === 'community_share')
    .map((r) => r.content_id);

  const [{ data: comments }, { data: shares }] = await Promise.all([
    commentIds.length > 0
      ? supabase.from('festival_comments').select('id, texto, oculto').in('id', commentIds)
      : Promise.resolve({ data: [] as { id: string; texto: string; oculto: boolean }[] }),
    shareIds.length > 0
      ? supabase.from('community_shares').select('id, caption, oculto').in('id', shareIds)
      : Promise.resolve({ data: [] as { id: string; caption: string | null; oculto: boolean }[] }),
  ]);

  const commentById = new Map((comments ?? []).map((c) => [c.id, c]));
  const shareById = new Map((shares ?? []).map((s) => [s.id, s]));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Moderación</h1>
      <p className="mt-1 text-sm text-gray-500">
        Reportes pendientes sobre comentarios de festival y canciones/playlists compartidas en
        Trends comunitarios — las dos únicas superficies con texto libre de usuario.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {(reports ?? []).map((r) => {
          const content =
            r.content_type === 'festival_comment' ? commentById.get(r.content_id) : shareById.get(r.content_id);
          const text = content
            ? 'texto' in content
              ? content.texto
              : content.caption ?? '(sin texto, solo canciones)'
            : '(contenido ya borrado)';
          const alreadyHidden = content?.oculto ?? false;

          return (
            <li key={r.id} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400">
                    {r.content_type === 'festival_comment' ? 'Comentario de festival' : 'Share comunitario'} ·
                    reportado por {MOTIVO_LABEL[r.motivo] ?? r.motivo} ·{' '}
                    {new Date(r.created_at).toLocaleString('es-MX')}
                    {alreadyHidden && ' · ya oculto'}
                  </p>
                  <p className="mt-1">&quot;{text}&quot;</p>
                </div>
                <ReportActions
                  reportId={r.id}
                  contentType={r.content_type as 'festival_comment' | 'community_share'}
                  contentId={r.content_id}
                />
              </div>
            </li>
          );
        })}
        {(reports ?? []).length === 0 && (
          <p className="text-sm text-gray-500">No hay reportes pendientes.</p>
        )}
      </ul>
    </main>
  );
}
