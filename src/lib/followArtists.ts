import { supabase } from './supabase';

export async function fetchFollowedArtistIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('followed_artists').select('artist_id').eq('user_id', userId);
  if (error) {
    console.error('No se pudieron cargar los artistas seguidos:', error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.artist_id));
}

export async function followArtist(userId: string, artistId: string): Promise<boolean> {
  const { error } = await supabase.from('followed_artists').insert({ user_id: userId, artist_id: artistId });
  if (error) {
    console.error('No se pudo seguir al artista:', error);
    return false;
  }
  return true;
}

export async function unfollowArtist(userId: string, artistId: string): Promise<boolean> {
  const { error } = await supabase.from('followed_artists').delete().eq('user_id', userId).eq('artist_id', artistId);
  if (error) {
    console.error('No se pudo dejar de seguir al artista:', error);
    return false;
  }
  return true;
}

export type FollowedArtist = { artist_id: string; name: string };

// Para la pantalla de "Artistas seguidos" en Perfil. Dos consultas simples
// en vez de un embedded select — followed_artists no trae nada más que
// resolver, y así se evita depender de cómo supabase-js tipa la relación.
export async function fetchFollowedArtistsWithNames(userId: string): Promise<FollowedArtist[]> {
  const { data: follows, error: followsError } = await supabase
    .from('followed_artists')
    .select('artist_id')
    .eq('user_id', userId);
  if (followsError) {
    console.error('No se pudieron cargar los artistas seguidos:', followsError);
    return [];
  }
  const artistIds = (follows ?? []).map((r) => r.artist_id);
  if (artistIds.length === 0) return [];

  const { data: artists, error: artistsError } = await supabase.from('artists').select('id, name').in('id', artistIds);
  if (artistsError) {
    console.error('No se pudieron resolver los nombres de artistas seguidos:', artistsError);
    return [];
  }
  return (artists ?? []).map((a) => ({ artist_id: a.id, name: a.name })).sort((a, b) => a.name.localeCompare(b.name));
}
