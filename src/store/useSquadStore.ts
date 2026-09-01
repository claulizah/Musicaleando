import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

export type SquadMemberWithProfile = {
  user_id: string;
  compat_score: number;
  joined_at: string;
  arquetipo: string | null;
  generos: string[];
  energia: number;
};

export type SquadWithMembers = {
  squad: Tables<'squads'>;
  members: SquadMemberWithProfile[];
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

type SquadState = {
  squads: SquadWithMembers[];
  status: Status;
  error: string | null;
  fetchMySquads: (userId: string) => Promise<void>;
  createSquad: (nombre: string) => Promise<void>;
  joinSquad: (code: string) => Promise<void>;
  leaveSquad: (squadId: string, userId: string) => Promise<void>;
};

export const useSquadStore = create<SquadState>((set, get) => ({
  squads: [],
  status: 'idle',
  error: null,

  fetchMySquads: async (userId) => {
    set({ status: 'loading', error: null });

    const { data: myMemberships, error: memErr } = await supabase
      .from('squad_members')
      .select('squad_id')
      .eq('user_id', userId);

    if (memErr) {
      set({ status: 'error', error: memErr.message });
      return;
    }

    const squadIds = (myMemberships ?? []).map((m) => m.squad_id);
    if (squadIds.length === 0) {
      set({ squads: [], status: 'ready' });
      return;
    }

    const { data: squadRows, error: squadErr } = await supabase
      .from('squads')
      .select('*')
      .in('id', squadIds);

    if (squadErr) {
      set({ status: 'error', error: squadErr.message });
      return;
    }

    const { data: memberRows, error: memberErr } = await supabase
      .from('squad_members')
      .select('*')
      .in('squad_id', squadIds);

    if (memberErr) {
      set({ status: 'error', error: memberErr.message });
      return;
    }

    const allUserIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];
    const { data: profileRows, error: profileErr } = await supabase
      .from('music_profile')
      .select('user_id, arquetipo, generos, energia')
      .in('user_id', allUserIds);

    if (profileErr) {
      set({ status: 'error', error: profileErr.message });
      return;
    }

    const profileByUser = new Map((profileRows ?? []).map((p) => [p.user_id, p]));

    const squads: SquadWithMembers[] = (squadRows ?? []).map((squad) => ({
      squad,
      members: (memberRows ?? [])
        .filter((m) => m.squad_id === squad.id)
        .map((m) => {
          const profile = profileByUser.get(m.user_id);
          return {
            user_id: m.user_id,
            compat_score: m.compat_score,
            joined_at: m.joined_at,
            arquetipo: profile?.arquetipo ?? null,
            generos: (profile?.generos as string[]) ?? [],
            energia: profile?.energia ?? 0.5,
          };
        }),
    }));

    set({ squads, status: 'ready' });
  },

  createSquad: async (nombre) => {
    const { error } = await supabase.rpc('create_squad', { p_nombre: nombre });
    if (error) throw error;
  },

  joinSquad: async (code) => {
    const { error } = await supabase.rpc('join_squad', { p_invite_code: code });
    if (error) throw error;
  },

  leaveSquad: async (squadId, userId) => {
    const { error } = await supabase
      .from('squad_members')
      .delete()
      .eq('squad_id', squadId)
      .eq('user_id', userId);
    if (error) throw error;
    set({ squads: get().squads.filter((s) => s.squad.id !== squadId) });
  },
}));
