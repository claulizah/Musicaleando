import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Mood } from '../types/database';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type MoodState = {
  today: Mood | null;
  status: Status;
  error: string | null;
  fetchLatest: (userId: string) => Promise<void>;
  setMood: (userId: string, mood: Mood) => Promise<void>;
};

export const useMoodStore = create<MoodState>((set) => ({
  today: null,
  status: 'idle',
  error: null,

  fetchLatest: async (userId) => {
    set({ status: 'loading', error: null });
    const { data, error } = await supabase
      .from('mood_logs')
      .select('mood')
      .eq('user_id', userId)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }
    set({ today: (data?.mood as Mood) ?? null, status: 'ready' });
  },

  // mood_logs is append-only: every change inserts a new row, never updates one.
  setMood: async (userId, mood) => {
    const previous = useMoodStore.getState().today;
    set({ today: mood });
    const { error } = await supabase.from('mood_logs').insert({ user_id: userId, mood });
    if (error) {
      set({ today: previous, status: 'error', error: error.message });
    }
  },
}));
