'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { sanitizeGenres } from '@/lib/artistGenres';

// Guarda de inmediato los géneros de UN artista. Solo ids de la lista controlada;
// el texto libre solo se conserva si "Otro" está marcado.
export async function setArtistGenres(
  artistId: string,
  genres: string[],
  genreOther: string,
): Promise<{ error?: string; genres?: string[] | null; genre_other?: string | null }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const clean = sanitizeGenres(genres);
  const other = clean?.includes('otro') ? genreOther.trim().slice(0, 80) || null : null;

  const supabase = await createClient();
  const { error } = await supabase.from('artists').update({ genres: clean, genre_other: other }).eq('id', artistId);
  if (error) return { error: error.message };

  revalidatePath('/admin/artistas');
  return { genres: clean, genre_other: other };
}
