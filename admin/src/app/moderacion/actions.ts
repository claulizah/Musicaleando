'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export async function hideReportedContent(
  reportId: string,
  contentType: 'festival_comment' | 'community_share',
  contentId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const table = contentType === 'festival_comment' ? 'festival_comments' : 'community_shares';

  const { error: hideError } = await supabase.from(table).update({ oculto: true }).eq('id', contentId);
  if (hideError) return { error: hideError.message };

  const { error: reportError } = await supabase
    .from('content_reports')
    .update({ resuelto: true, resuelto_at: new Date().toISOString() })
    .eq('id', reportId);
  if (reportError) return { error: reportError.message };

  revalidatePath('/moderacion');
  return {};
}

// A diferencia de comentarios/shares ("ocultar, nunca borrar"), el spec pide
// explícitamente que una foto reportada se pueda ELIMINAR de verdad — fotos
// tienen un riesgo/costo distinto al texto. Borra el objeto de Storage y la
// fila de metadata, y resuelve el reporte en el mismo paso.
export async function deleteReportedPhoto(
  reportId: string,
  albumId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();

  const { data: photo, error: fetchError } = await supabase
    .from('concert_album')
    .select('foto_path')
    .eq('id', albumId)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };

  if (photo) {
    const { error: storageError } = await supabase.storage.from('concert-album').remove([photo.foto_path]);
    if (storageError) return { error: storageError.message };

    const { error: deleteError } = await supabase.from('concert_album').delete().eq('id', albumId);
    if (deleteError) return { error: deleteError.message };
  }
  // If the row is already gone (e.g. the owner deleted it themselves after
  // being reported), just resolve the report — nothing left to remove.

  const { error: reportError } = await supabase
    .from('content_reports')
    .update({ resuelto: true, resuelto_at: new Date().toISOString() })
    .eq('id', reportId);
  if (reportError) return { error: reportError.message };

  revalidatePath('/moderacion');
  return {};
}

export async function dismissReport(reportId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('content_reports')
    .update({ resuelto: true, resuelto_at: new Date().toISOString() })
    .eq('id', reportId);
  if (error) return { error: error.message };

  revalidatePath('/moderacion');
  return {};
}
