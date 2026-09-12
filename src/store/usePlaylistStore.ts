import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

type Song = Tables<'songs'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

type PlaylistState = {
  songs: Song[];
  status: Status;
  error: string | null;
  fetch: (generos: string[]) => Promise<void>;
};

const LIMIT = 8;

// Generic "playlist del día basada en perfil musical" — the fallback used
// when the active mood-actividad (see useMoodPlaylistStore) has no approved
// candidates yet. No longer filtered by mood: the old genre-flavored moods
// (fiesta/chill/electronica) this table's `mood` column used are unrelated
// to the new mood-actividad/emoción selector, so this always widens straight
// to genre-only.
export const usePlaylistStore = create<PlaylistState>((set) => ({
  songs: [],
  status: 'idle',
  error: null,

  fetch: async (generos) => {
    set({ status: 'loading', error: null });

    if (generos.length === 0) {
      set({ songs: [], status: 'ready' });
      return;
    }

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .in('genero', generos)
      .order('orden')
      .limit(LIMIT);

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    set({ songs: data ?? [], status: 'ready' });
  },
}));
