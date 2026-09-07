import { supabase } from './supabase';

export type TournamentArtist = {
  id: string;
  name: string;
  imageUrl?: string;
  // The internal quiz genre id (e.g. "indie") this artist was sourced from —
  // used to reinforce that genre in music_profile.generos when this artist
  // is crowned champion.
  generoId: string;
};

// Calls the `spotify-artists` Edge Function, which does Spotify's Client
// Credentials flow server-side (the client secret must never ship in the
// mobile bundle) and returns 8 real artists drawn from the given genres.
export async function fetchTournamentArtists(generos: string[]): Promise<TournamentArtist[]> {
  const { data, error } = await supabase.functions.invoke<{ artists?: TournamentArtist[]; error?: string }>(
    'spotify-artists',
    { body: { generos } },
  );

  if (error) throw error;
  if (!data?.artists || data.artists.length === 0) {
    throw new Error(data?.error ?? 'No se pudieron cargar artistas para el torneo.');
  }
  return data.artists;
}

export type RecommendedArtist = TournamentArtist & { matchedChampion: boolean };

// Recomendaciones V1 (motor propio) — ranked by genre overlap with the
// user's `generos`, boosted when an artist's genre matches their Torneo
// Sonoro champion. See supabase/functions/recommend-artists for why this
// isn't a literal cosine similarity (Spotify doesn't expose per-artist
// genres/popularity at this app's tier).
export async function fetchRecommendedArtists(
  generos: string[],
  championGenreId?: string,
  excludeArtistIds?: string[],
): Promise<RecommendedArtist[]> {
  const { data, error } = await supabase.functions.invoke<{ artists?: RecommendedArtist[]; error?: string }>(
    'recommend-artists',
    { body: { generos, championGenreId, excludeArtistIds } },
  );

  if (error) throw error;
  return data?.artists ?? [];
}

export type FestivalGenreMatch = { artista: string; generoId: string };

// "Festival generado por gustos" — matches a festival's real lineup names
// against the user's genres via the same reverse-index technique.
export async function fetchFestivalPersonalization(
  generos: string[],
  lineup: string[],
): Promise<{ matches: FestivalGenreMatch[]; totalLineup: number }> {
  const { data, error } = await supabase.functions.invoke<{
    matches?: FestivalGenreMatch[];
    totalLineup?: number;
    error?: string;
  }>('personalize-festival', { body: { generos, lineup } });

  if (error) throw error;
  return { matches: data?.matches ?? [], totalLineup: data?.totalLineup ?? lineup.length };
}
