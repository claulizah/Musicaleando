import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';
import { useSessionStore } from './useSessionStore';

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

export type SquadComparisonRow = {
  user_id: string;
  nombre: string | null;
  energia: number;
  generos_count: number;
  festivales_confirmados: number;
  // Match por historial compartido (Backlog v2): festivales donde tanto el
  // que llama como este miembro marcaron "voy" — null para la fila propia
  // (no aplica "en común contigo mismo").
  festivales_en_comun: number | null;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

type SquadState = {
  squads: SquadWithMembers[];
  status: Status;
  error: string | null;
  comparisonBySquad: Record<string, SquadComparisonRow[]>;
  fetchMySquads: (userId: string) => Promise<void>;
  createSquad: (nombre: string) => Promise<void>;
  joinSquad: (code: string) => Promise<void>;
  leaveSquad: (squadId: string, userId: string) => Promise<void>;
  fetchComparison: (squadId: string) => Promise<void>;
};

export const useSquadStore = create<SquadState>((set, get) => ({
  squads: [],
  status: 'idle',
  error: null,
  comparisonBySquad: {},

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

    // music_profile only has a select-own RLS policy, so a direct client
    // query for every member's profile (the old approach here) silently
    // returns nothing for anyone but the caller — confirmed live with a
    // disposable test squad while auditing this pattern. squad_members_with_profile
    // is a SECURITY DEFINER RPC (same shape as squad_comparison) that reads
    // real profile data for a squad's members, gated by is_squad_member().
    const membersBySquad = await Promise.all(
      squadIds.map(async (squadId) => {
        const { data, error } = await supabase.rpc('squad_members_with_profile', {
          p_squad_id: squadId,
        });
        if (error) throw error;
        return { squadId, members: data ?? [] };
      }),
    ).catch((err: unknown) => {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
      return null;
    });

    if (!membersBySquad) return;

    const membersMap = new Map(membersBySquad.map((m) => [m.squadId, m.members]));

    const squads: SquadWithMembers[] = (squadRows ?? []).map((squad) => ({
      squad,
      members: (membersMap.get(squad.id) ?? []).map((m) => ({
        user_id: m.user_id,
        compat_score: m.compat_score,
        joined_at: m.joined_at,
        arquetipo: m.arquetipo,
        generos: (m.generos as string[]) ?? [],
        energia: m.energia,
      })),
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

    // Only drop the whole squad from local state when the current session's own
    // membership was removed. When the owner removes someone else, the squad
    // itself is still ours — just prune that one member, or the screen briefly
    // flashes "Cargando squad..." while it silently refetches from scratch.
    if (userId === useSessionStore.getState().userId) {
      set({ squads: get().squads.filter((s) => s.squad.id !== squadId) });
    } else {
      set({
        squads: get().squads.map((s) =>
          s.squad.id === squadId ? { ...s, members: s.members.filter((m) => m.user_id !== userId) } : s,
        ),
      });
    }
  },

  fetchComparison: async (squadId) => {
    // Squadmates' music_profile rows aren't readable directly by the client
    // (RLS only allows selecting your own) — this RPC is a narrow, scoped
    // read that bypasses that for one squad at a time, gated by
    // is_squad_member() same as everything else squad-related.
    const { data, error } = await supabase.rpc('squad_comparison', { p_squad_id: squadId });
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ comparisonBySquad: { ...get().comparisonBySquad, [squadId]: data ?? [] } });
  },
}));
