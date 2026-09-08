import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { TournamentArtist } from '../lib/spotify';
import { Json, Tables } from '../types/database';

export type SquadTournamentState = Tables<'squad_tournaments'>;

type Status = 'idle' | 'loading' | 'ready' | 'error';

type StoreState = {
  stateBySquad: Record<string, SquadTournamentState | null>;
  votesByTurn: Record<string, Tables<'squad_tournament_votes'>[]>; // key: `${squadId}:${turn}`
  status: Status;
  error: string | null;
  fetch: (squadId: string) => Promise<void>;
  start: (squadId: string, artists: TournamentArtist[]) => Promise<void>;
  vote: (squadId: string, turn: number, userId: string, artistId: string) => Promise<void>;
  advance: (squadId: string) => Promise<void>;
};

function voteKey(squadId: string, turn: number) {
  return `${squadId}:${turn}`;
}

export const useSquadTournamentStore = create<StoreState>((set, get) => ({
  stateBySquad: {},
  votesByTurn: {},
  status: 'idle',
  error: null,

  fetch: async (squadId) => {
    set({ status: 'loading', error: null });

    const { data: tournament, error: tErr } = await supabase
      .from('squad_tournaments')
      .select('*')
      .eq('squad_id', squadId)
      .maybeSingle();

    if (tErr) {
      set({ status: 'error', error: tErr.message });
      return;
    }

    if (!tournament) {
      set({ stateBySquad: { ...get().stateBySquad, [squadId]: null }, status: 'ready' });
      return;
    }

    const { data: votes, error: vErr } = await supabase
      .from('squad_tournament_votes')
      .select('*')
      .eq('squad_id', squadId)
      .eq('turn', tournament.turn);

    if (vErr) {
      set({ status: 'error', error: vErr.message });
      return;
    }

    set({
      stateBySquad: { ...get().stateBySquad, [squadId]: tournament },
      votesByTurn: { ...get().votesByTurn, [voteKey(squadId, tournament.turn)]: votes ?? [] },
      status: 'ready',
    });
  },

  start: async (squadId, artists) => {
    const { error } = await supabase.rpc('start_squad_tournament', {
      p_squad_id: squadId,
      p_artists: artists as unknown as Json,
    });
    if (error) throw error;
    await get().fetch(squadId);
  },

  vote: async (squadId, turn, userId, artistId) => {
    const { error } = await supabase
      .from('squad_tournament_votes')
      .upsert({ squad_id: squadId, turn, user_id: userId, artist_id: artistId }, { onConflict: 'squad_id,turn,user_id' });
    if (error) throw error;
    await get().fetch(squadId);
  },

  advance: async (squadId) => {
    const { error } = await supabase.rpc('advance_squad_tournament', { p_squad_id: squadId });
    if (error) throw error;
    await get().fetch(squadId);
  },
}));
