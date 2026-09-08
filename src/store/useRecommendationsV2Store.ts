import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

export type RecommendationV2 = Tables<'recommendation_cache'>;
type Status = 'idle' | 'loading' | 'ready' | 'error';

type RecommendationsV2State = {
  recommendations: RecommendationV2[];
  status: Status;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
};

// V2 · Colaborativo propio (spec): "Gente con tu arquetipo o alta
// compatibilidad también eligió X", computed nightly in Postgres
// (generate_recommendations_v2_for_all, pg_cron) from Torneo Sonoro
// champions among people sharing the user's arquetipo or squad. This store
// only ever reads the cache the batch already filled — it never computes
// anything itself. If the cache is empty (cold start: no squadmates/peers
// with a champion yet), it self-serves one refresh so a user isn't stuck
// waiting for the next nightly run, then accepts an empty result as final
// for this session — same shape as useTrendStore's self-serve fallback.
export const useRecommendationsV2Store = create<RecommendationsV2State>((set) => ({
  recommendations: [],
  status: 'idle',
  error: null,

  fetch: async (userId) => {
    set({ status: 'loading', error: null });

    const { data, error } = await supabase
      .from('recommendation_cache')
      .select('*')
      .eq('user_id', userId)
      .eq('fuente', 'v2_colaborativo')
      .order('score', { ascending: false });

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    if (data && data.length > 0) {
      set({ recommendations: data, status: 'ready' });
      return;
    }

    const { error: refreshError } = await supabase.rpc('refresh_my_recommendations_v2');
    if (refreshError) {
      set({ status: 'error', error: refreshError.message });
      return;
    }

    const { data: freshData, error: refetchError } = await supabase
      .from('recommendation_cache')
      .select('*')
      .eq('user_id', userId)
      .eq('fuente', 'v2_colaborativo')
      .order('score', { ascending: false });

    if (refetchError) {
      set({ status: 'error', error: refetchError.message });
      return;
    }

    set({ recommendations: freshData ?? [], status: 'ready' });
  },
}));
