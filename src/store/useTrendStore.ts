import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

type Trend = Tables<'trends'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

type TrendState = {
  trend: Trend | null;
  history: Trend[];
  status: Status;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
  fetchHistory: (userId: string) => Promise<void>;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const HISTORY_DAYS = 14;

export const useTrendStore = create<TrendState>((set) => ({
  trend: null,
  history: [],
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

  // "Trends avanzados" (Sprint 5): each daily trend was always persisted in
  // `trends` (one row per user per day, via the unique(user_id, fecha)
  // constraint the upsert relies on) but nothing ever surfaced more than
  // today's row. This just reads what already exists — no new table.
  fetchHistory: async (userId) => {
    const since = new Date();
    since.setDate(since.getDate() - HISTORY_DAYS);
    const sinceIso = since.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('trends')
      .select('*')
      .eq('user_id', userId)
      .gte('fecha', sinceIso)
      .lt('fecha', todayIso())
      .order('fecha', { ascending: false });

    if (error) {
      set({ error: error.message });
      return;
    }
    set({ history: data ?? [] });
  },
}));
