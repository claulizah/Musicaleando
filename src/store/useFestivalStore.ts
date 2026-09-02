import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { FestivalStatus, Tables } from '../types/database';

export type FestivalWithIntent = {
  festival: Tables<'festivals'>;
  myStatus: FestivalStatus | null;
  squadGoingCount: number;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

type FestivalState = {
  festivals: FestivalWithIntent[];
  status: Status;
  error: string | null;
  fetch: (userId: string) => Promise<void>;
  setStatus: (userId: string, festivalId: string, newStatus: FestivalStatus) => Promise<void>;
};

export const useFestivalStore = create<FestivalState>((set, get) => ({
  festivals: [],
  status: 'idle',
  error: null,

  fetch: async (userId) => {
    set({ status: 'loading', error: null });

    const { data: festivalRows, error: festErr } = await supabase
      .from('festivals')
      .select('*')
      .order('fecha_inicio');

    if (festErr) {
      set({ status: 'error', error: festErr.message });
      return;
    }

    const festivalIds = (festivalRows ?? []).map((f) => f.id);
    if (festivalIds.length === 0) {
      set({ festivals: [], status: 'ready' });
      return;
    }

    // RLS scopes this to my own rows + my squadmates' rows automatically.
    const { data: intentRows, error: intentErr } = await supabase
      .from('festival_intent')
      .select('*')
      .in('festival_id', festivalIds);

    if (intentErr) {
      set({ status: 'error', error: intentErr.message });
      return;
    }

    const festivals: FestivalWithIntent[] = (festivalRows ?? []).map((festival) => {
      const rowsForFestival = (intentRows ?? []).filter((i) => i.festival_id === festival.id);
      const mine = rowsForFestival.find((i) => i.user_id === userId);
      const squadGoingCount = rowsForFestival.filter(
        (i) => i.user_id !== userId && i.status === 'voy',
      ).length;

      return {
        festival,
        myStatus: (mine?.status as FestivalStatus) ?? null,
        squadGoingCount,
      };
    });

    set({ festivals, status: 'ready' });
  },

  setStatus: async (userId, festivalId, newStatus) => {
    const previous = get().festivals;
    set({
      festivals: previous.map((f) =>
        f.festival.id === festivalId ? { ...f, myStatus: newStatus } : f,
      ),
    });

    const { error } = await supabase
      .from('festival_intent')
      .upsert(
        { user_id: userId, festival_id: festivalId, status: newStatus },
        { onConflict: 'user_id,festival_id' },
      );

    if (error) {
      set({ festivals: previous, status: 'error', error: error.message });
    }
  },
}));
