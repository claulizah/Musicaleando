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
