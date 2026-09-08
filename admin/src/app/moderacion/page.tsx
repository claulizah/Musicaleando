import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { ReportActions } from './report-actions';

const MOTIVO_LABEL: Record<string, string> = {
  spam: 'Spam',
  ofensivo: 'Ofensivo',
  otro: 'Otro',
};

const SIGNED_URL_TTL_SECONDS = 3600;

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
  const photoIds = (reports ?? [])
    .filter((r) => r.content_type === 'concert_photo')
    .map((r) => r.content_id);

  const [{ data: comments }, { data: shares }, { data: photos }] = await Promise.all([
    commentIds.length > 0
      ? supabase.from('festival_comments').select('id, texto, oculto').in('id', commentIds)
      : Promise.resolve({ data: [] as { id: string; texto: string; oculto: boolean }[] }),
    shareIds.length > 0
      ? supabase.from('community_shares').select('id, caption, oculto').in('id', shareIds)
      : Promise.resolve({ data: [] as { id: string; caption: string | null; oculto: boolean }[] }),
    photoIds.length > 0
      ? supabase.from('concert_album').select('id, foto_path').in('id', photoIds)
      : Promise.resolve({ data: [] as { id: string; foto_path: string }[] }),
  ]);

  const commentById = new Map((comments ?? []).map((c) => [c.id, c]));
  const shareById = new Map((shares ?? []).map((s) => [s.id, s]));
  const photoById = new Map((photos ?? []).map((p) => [p.id, p]));

  // Admin can read concert-album objects regardless of squad (storage policy
  // grants is_admin full read) — resolve a signed URL per reported photo so
  // the report can actually be reviewed, not just guessed at.
  const signedUrlByPhotoId = new Map<string, string>();
  await Promise.all(
    Array.from(photoById.values()).map(async (p) => {
      const { data } = await supabase.storage
        .from('concert-album')
        .createSignedUrl(p.foto_path, SIGNED_URL_TTL_SECONDS);
      if (data?.signedUrl) signedUrlByPhotoId.set(p.id, data.signedUrl);
    }),
  );

  const CONTENT_TYPE_LABEL: Record<string, string> = {
    festival_comment: 'Comentario de festival',
    community_share: 'Share comunitario',
    concert_photo: 'Foto de álbum de conciertos',
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Moderación</h1>
      <p className="mt-1 text-sm text-gray-500">
        Reportes pendientes sobre comentarios de festival, canciones/playlists compartidas en
        Trends comunitarios, y fotos del álbum de conciertos.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {(reports ?? []).map((r) => {
          const isPhoto = r.content_type === 'concert_photo';
          const content = isPhoto
            ? null
            : r.content_type === 'festival_comment'
              ? commentById.get(r.content_id)
              : shareById.get(r.content_id);
          const text =
            content && 'texto' in content
              ? content.texto
              : content && 'caption' in content
                ? content.caption ?? '(sin texto, solo canciones)'
                : null;
          const alreadyHidden = content?.oculto ?? false;
          const signedUrl = isPhoto ? signedUrlByPhotoId.get(r.content_id) : undefined;

          return (
            <li key={r.id} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400">
                    {CONTENT_TYPE_LABEL[r.content_type] ?? r.content_type} · reportado por{' '}
                    {MOTIVO_LABEL[r.motivo] ?? r.motivo} · {new Date(r.created_at).toLocaleString('es-MX')}
                    {alreadyHidden && ' · ya oculto'}
                  </p>
                  {isPhoto ? (
                    signedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signedUrl} alt="Foto reportada" className="mt-2 max-h-48 rounded-md" />
                    ) : (
                      <p className="mt-1 text-gray-500">(la foto ya no existe)</p>
                    )
                  ) : (
                    <p className="mt-1">&quot;{text}&quot;</p>
                  )}
                </div>
                <ReportActions
                  reportId={r.id}
                  contentType={r.content_type as 'festival_comment' | 'community_share' | 'concert_photo'}
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
