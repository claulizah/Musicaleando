import { create } from 'zustand';
import { fetchRecommendedArtists, RecommendedArtist } from '../lib/spotify';

type Status = 'idle' | 'loading' | 'ready' | 'error';

type RecommendationsState = {
  artists: RecommendedArtist[];
  status: Status;
  error: string | null;
  fetch: (generos: string[], championGenreId?: string) => Promise<void>;
};

export const useRecommendationsStore = create<RecommendationsState>((set) => ({
  artists: [],
  status: 'idle',
  error: null,

  fetch: async (generos, championGenreId) => {
    if (generos.length === 0) {
      set({ artists: [], status: 'ready', error: null });
      return;
    }
    set({ status: 'loading', error: null });
    try {
      const artists = await fetchRecommendedArtists(generos, championGenreId);
      set({ artists, status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
