import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

export type SquadPlaylistTrack = Tables<'squad_playlist'> & {
  song: Tables<'songs'>;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

type SquadPlaylistState = {
  tracksBySquad: Record<string, SquadPlaylistTrack[]>;
  status: Status;
  error: string | null;
  fetch: (squadId: string) => Promise<void>;
  addSong: (squadId: string, songId: string, userId: string) => Promise<void>;
  removeTrack: (squadId: string, trackId: string) => Promise<void>;
};

export const useSquadPlaylistStore = create<SquadPlaylistState>((set, get) => ({
  tracksBySquad: {},
  status: 'idle',
  error: null,

  fetch: async (squadId) => {
    set({ status: 'loading', error: null });

    const { data, error } = await supabase
      .from('squad_playlist')
      .select('*, song:songs(*)')
      .eq('squad_id', squadId)
      .order('added_at');

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    set({
      tracksBySquad: { ...get().tracksBySquad, [squadId]: (data as SquadPlaylistTrack[]) ?? [] },
      status: 'ready',
    });
  },

  addSong: async (squadId, songId, userId) => {
    const { error } = await supabase
      .from('squad_playlist')
      .insert({ squad_id: squadId, song_id: songId, added_by: userId });
    if (error) throw error;
    await get().fetch(squadId);
  },

  removeTrack: async (squadId, trackId) => {
    const { error } = await supabase.from('squad_playlist').delete().eq('id', trackId);
    if (error) throw error;
    set({
      tracksBySquad: {
        ...get().tracksBySquad,
        [squadId]: (get().tracksBySquad[squadId] ?? []).filter((t) => t.id !== trackId),
      },
    });
  },
}));
