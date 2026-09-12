import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

export type MoodPlaylistItem = Tables<'mood_playlists'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

type MoodPlaylistState = {
  songs: MoodPlaylistItem[];
  status: Status;
  error: string | null;
  fetch: (moodId: string, generos: string[]) => Promise<void>;
};

const LIMIT = 8;

export const useMoodPlaylistStore = create<MoodPlaylistState>((set) => ({
  songs: [],
  status: 'idle',
  error: null,

  // Approved candidates for this mood-actividad, prioritizing (client-side)
  // whichever ones match a genre already in the user's MusicProfile — e.g.
  // "Fiestero" surfaces reggaetón/latin tracks first for a user whose
  // profile already leans latin, before other approved-but-unrelated genres.
  // Empty result here means "no curated candidates yet for this mood" — the
  // caller (HomeScreen) is expected to fall back to the generic
  // profile-based playlist in that case, never to render an empty screen.
  fetch: async (moodId, generos) => {
    set({ status: 'loading', error: null });
    const { data, error } = await supabase
      .from('mood_playlists')
      .select('*')
      .eq('mood_id', moodId)
      .eq('estado', 'aprobado')
      .order('created_at', { ascending: true });

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    const rows = data ?? [];
    const sorted = [...rows].sort((a, b) => {
      const aMatch = a.genero && generos.includes(a.genero) ? 0 : 1;
      const bMatch = b.genero && generos.includes(b.genero) ? 0 : 1;
      return aMatch - bMatch;
    });

    set({ songs: sorted.slice(0, LIMIT), status: 'ready' });
  },
}));
