'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export async function approveCandidate(id: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('mood_playlists').update({ estado: 'aprobado' }).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/mood');
  return {};
}

export async function discardCandidate(id: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('mood_playlists').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/mood');
  return {};
}

export async function addManualTrack(formData: FormData): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const moodId = String(formData.get('mood_id') ?? '').trim();
  const titulo = String(formData.get('titulo') ?? '').trim();
  const artista = String(formData.get('artista') ?? '').trim();
  const genero = String(formData.get('genero') ?? '').trim() || null;

  if (!moodId || !titulo || !artista) {
    return { error: 'Mood, título y artista son obligatorios.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('mood_playlists')
    .insert({ mood_id: moodId, titulo, artista, genero, fuente: 'manual', estado: 'aprobado' });

  if (error) return { error: error.message };

  revalidatePath('/mood');
  return {};
}

// Resultado elegido de la iTunes Search API — Claudia ya lo confirmó al
// hacer clic sobre un resultado real, así que se guarda directo como
// 'aprobado' (mismo criterio que addManualTrack: la confirmación humana de
// un track específico no necesita pasar otra vez por la bandeja de
// pendientes, a diferencia de lo que trae syncFromLastfm sin curar).
export async function addFromItunes(
  moodId: string,
  titulo: string,
  artista: string,
  genero: string | null,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  if (!moodId || !titulo.trim() || !artista.trim()) {
    return { error: 'Mood, título y artista son obligatorios.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('mood_playlists')
    .insert({ mood_id: moodId, titulo: titulo.trim(), artista: artista.trim(), genero, fuente: 'itunes', estado: 'aprobado' });

  if (error) return { error: error.message };

  revalidatePath('/mood');
  return {};
}

export async function syncFromLastfm(
  moodId: string,
  tag: string,
): Promise<{ error?: string; added?: number; skipped?: number }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const trimmedTag = tag.trim();
  if (!trimmedTag) return { error: 'Falta el tag de Last.fm.' };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{
    tracks?: { titulo: string; artista: string }[];
    error?: string;
  }>('lastfm-mood-sync', { body: { tag: trimmedTag, limit: 10 } });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  const tracks = data?.tracks ?? [];
  if (tracks.length === 0) {
    return { error: `Last.fm no devolvió resultados para el tag "${trimmedTag}".` };
  }

  // Dedupe against candidates already sitting in the tray for this mood
  // (pending or approved) so re-running the sync doesn't pile up repeats.
  const { data: existing } = await supabase
    .from('mood_playlists')
    .select('titulo, artista')
    .eq('mood_id', moodId);
  const existingKeys = new Set((existing ?? []).map((e) => `${e.titulo}::${e.artista}`.toLowerCase()));

  const newRows = tracks
    .filter((t) => !existingKeys.has(`${t.titulo}::${t.artista}`.toLowerCase()))
    .map((t) => ({
      mood_id: moodId,
      titulo: t.titulo,
      artista: t.artista,
      fuente: 'lastfm' as const,
      estado: 'pendiente' as const,
    }));

  if (newRows.length > 0) {
    const { error: insertError } = await supabase.from('mood_playlists').insert(newRows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath('/mood');
  return { added: newRows.length, skipped: tracks.length - newRows.length };
}
