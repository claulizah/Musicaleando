import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';
import { LevelDef, levelForFestivalCount } from '../lib/levels';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type AchievementsState = {
  badges: Tables<'user_badges'>[];
  festivalesConfirmados: number;
  level: LevelDef;
  status: Status;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
};

export const useAchievementsStore = create<AchievementsState>((set) => ({
  badges: [],
  festivalesConfirmados: 0,
  level: levelForFestivalCount(0),
  status: 'idle',
  error: null,

  fetch: async (userId) => {
    set({ status: 'loading', error: null });

    const [{ data: badgeRows, error: badgeErr }, { count, error: countErr }] = await Promise.all([
      supabase.from('user_badges').select('*').eq('user_id', userId),
      supabase
        .from('festival_intent')
        .select('festival_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'voy'),
    ]);

    if (badgeErr) {
      set({ status: 'error', error: badgeErr.message });
      return;
    }
    if (countErr) {
      set({ status: 'error', error: countErr.message });
      return;
    }

    const festivalesConfirmados = count ?? 0;
    set({
      badges: badgeRows ?? [],
      festivalesConfirmados,
      level: levelForFestivalCount(festivalesConfirmados),
      status: 'ready',
    });
  },
}));
