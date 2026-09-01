import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Mood, Tables } from '../types/database';

type Song = Tables<'songs'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

type PlaylistState = {
  songs: Song[];
  status: Status;
  error: string | null;
  fetch: (generos: string[], mood: Mood) => Promise<void>;
};

const LIMIT = 8;

export const usePlaylistStore = create<PlaylistState>((set) => ({
  songs: [],
  status: 'idle',
  error: null,

  fetch: async (generos, mood) => {
    set({ status: 'loading', error: null });

    if (generos.length === 0) {
      set({ songs: [], status: 'ready' });
      return;
    }

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .in('genero', generos)
      .eq('mood', mood)
      .order('orden')
      .limit(LIMIT);

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    if (data && data.length > 0) {
      set({ songs: data, status: 'ready' });
      return;
    }

    // Not enough curated songs for this exact mood — widen to genre only.
    const { data: fallback, error: fallbackError } = await supabase
      .from('songs')
      .select('*')
      .in('genero', generos)
      .order('orden')
      .limit(LIMIT);

    if (fallbackError) {
      set({ status: 'error', error: fallbackError.message });
      return;
    }

    set({ songs: fallback ?? [], status: 'ready' });
  },
}));
