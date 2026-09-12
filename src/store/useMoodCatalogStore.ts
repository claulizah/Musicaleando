import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

type MoodCatalogEntry = Tables<'mood_catalog'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

type MoodCatalogState = {
  moods: MoodCatalogEntry[];
  status: Status;
  error: string | null;
  fetch: () => Promise<void>;
};

// mood_catalog is a table, not a hardcoded enum, so a new mood-actividad can
// be added later with a single insert here — no app release/migration needed
// for the option to show up in the selector.
export const useMoodCatalogStore = create<MoodCatalogState>((set, get) => ({
  moods: [],
  status: 'idle',
  error: null,

  fetch: async () => {
    if (get().status === 'loading' || get().moods.length > 0) return;
    set({ status: 'loading', error: null });
    const { data, error } = await supabase.from('mood_catalog').select('*').order('orden');

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }
    set({ moods: data ?? [], status: 'ready' });
  },
}));
