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
