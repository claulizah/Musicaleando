import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

type Trend = Tables<'trends'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

type TrendState = {
  trend: Trend | null;
  status: Status;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export const useTrendStore = create<TrendState>((set) => ({
  trend: null,
  status: 'idle',
  error: null,

  fetch: async (userId) => {
    set({ status: 'loading', error: null });

    const { data, error } = await supabase
      .from('trends')
      .select('*')
      .eq('user_id', userId)
      .eq('fecha', todayIso())
      .maybeSingle();

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    if (data) {
      set({ trend: data, status: 'ready' });
      return;
    }

    // No trend yet for today (new profile, or the daily cron hasn't run) —
    // generate this user's own trend on demand instead of showing nothing.
    const { error: genError } = await supabase.rpc('generate_trend_for_user', { p_user_id: userId });
    if (genError) {
      set({ status: 'error', error: genError.message });
      return;
    }

    const { data: freshData, error: refetchError } = await supabase
      .from('trends')
      .select('*')
      .eq('user_id', userId)
      .eq('fecha', todayIso())
      .maybeSingle();

    if (refetchError) {
      set({ status: 'error', error: refetchError.message });
      return;
    }

    set({ trend: freshData, status: 'ready' });
  },
}));
