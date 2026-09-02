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
