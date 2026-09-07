'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export type LineupRow = {
  artista: string;
  escenario: string | null;
  horario: string | null;
};

export async function updateLinkBoletos(
  festivalId: string,
  linkBoletos: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('festivals')
    .update({ link_boletos: linkBoletos.trim() || null })
    .eq('id', festivalId);

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

export async function importLineup(
  festivalId: string,
  rows: LineupRow[],
): Promise<{ error?: string; imported?: number }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const validRows = rows
    .map((r) => ({ ...r, artista: r.artista.trim() }))
    .filter((r) => r.artista.length > 0);

  if (validRows.length === 0) {
    return { error: 'El CSV no tiene filas válidas (falta la columna "artista").' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('festival_lineup').insert(
    validRows.map((r) => ({
      festival_id: festivalId,
      artista: r.artista,
      escenario: r.escenario?.trim() || null,
      horario: r.horario?.trim() || null,
    })),
  );

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return { imported: validRows.length };
}

export async function deleteLineupRow(festivalId: string, rowId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('festival_lineup').delete().eq('id', rowId);

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

export async function createAnnouncement(
  festivalId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const tipo = String(formData.get('tipo') ?? '');
  const titulo = String(formData.get('titulo') ?? '').trim();
  const descripcion = String(formData.get('descripcion') ?? '').trim() || null;
  const sponsor_nombre = String(formData.get('sponsor_nombre') ?? '').trim() || null;
  const codigo_descuento = String(formData.get('codigo_descuento') ?? '').trim() || null;

  if (!['simple', 'rifa', 'descuento'].includes(tipo)) {
    return { error: 'Tipo de anuncio inválido.' };
  }
  if (!titulo) return { error: 'El anuncio necesita un título.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('announcements').insert({
    festival_id: festivalId,
    tipo,
    titulo,
    descripcion,
    sponsor_nombre,
    codigo_descuento: tipo === 'descuento' ? codigo_descuento : null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

export async function deleteAnnouncement(
  festivalId: string,
  announcementId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('announcements').delete().eq('id', announcementId);

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}
