import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

export type CommunityShareStats = Tables<'community_share_stats'>;
export type CommunityShareWithSongs = CommunityShareStats & {
  songs: Tables<'songs'>[];
  iVoted: boolean;
};

export type CommunityScope = 'global' | 'ciudad';
type Status = 'idle' | 'loading' | 'ready' | 'error';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type CommunityState = {
  shares: CommunityShareWithSongs[];
  scope: CommunityScope;
  status: Status;
  error: string | null;
  setScope: (scope: CommunityScope) => void;
  fetch: (userId: string, ciudad: string | null) => Promise<void>;
  shareSongs: (userId: string, songIds: string[], ciudad: string | null, caption?: string) => Promise<void>;
  toggleVote: (userId: string, shareId: string) => Promise<void>;
};

export const useCommunityStore = create<CommunityState>((set, get) => ({
  shares: [],
  scope: 'global',
  status: 'idle',
  error: null,

  setScope: (scope) => set({ scope }),

  fetch: async (userId, ciudad) => {
    set({ status: 'loading', error: null });
    const scope = get().scope;
    const sinceIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

    let query = supabase
      .from('community_share_stats')
      .select('*')
      .gte('created_at', sinceIso)
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (scope === 'ciudad' && ciudad) {
      query = query.eq('ciudad', ciudad);
    }

    const { data: statsRows, error: statsErr } = await query;
    if (statsErr) {
      set({ status: 'error', error: statsErr.message });
      return;
    }

    const rows = statsRows ?? [];
    const allSongIds = Array.from(new Set(rows.flatMap((r) => r.song_ids)));
    const shareIds = rows.map((r) => r.share_id);

    const [{ data: songRows, error: songsErr }, { data: voteRows, error: votesErr }] = await Promise.all([
      allSongIds.length > 0
        ? supabase.from('songs').select('*').in('id', allSongIds)
        : Promise.resolve({ data: [], error: null }),
      shareIds.length > 0
        ? supabase.from('community_share_votes').select('*').in('share_id', shareIds).eq('user_id', userId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (songsErr) {
      set({ status: 'error', error: songsErr.message });
      return;
    }
    if (votesErr) {
      set({ status: 'error', error: votesErr.message });
      return;
    }

    const songsById = new Map((songRows ?? []).map((s) => [s.id, s]));
    const votedShareIds = new Set((voteRows ?? []).map((v) => v.share_id));

    const shares: CommunityShareWithSongs[] = rows.map((r) => ({
      ...r,
      songs: r.song_ids.map((id) => songsById.get(id)).filter((s): s is Tables<'songs'> => Boolean(s)),
      iVoted: votedShareIds.has(r.share_id),
    }));

    set({ shares, status: 'ready' });
  },

  shareSongs: async (userId, songIds, ciudad, caption) => {
    const { error } = await supabase
      .from('community_shares')
      .insert({ user_id: userId, song_ids: songIds, ciudad, caption: caption ?? null });
    if (error) throw error;
    await get().fetch(userId, ciudad);
  },

  toggleVote: async (userId, shareId) => {
    const previous = get().shares;
    const alreadyVoted = previous.find((s) => s.share_id === shareId)?.iVoted ?? false;

    set({
      shares: previous.map((s) =>
        s.share_id === shareId
          ? { ...s, iVoted: !alreadyVoted, vote_count: s.vote_count + (alreadyVoted ? -1 : 1) }
          : s,
      ),
    });

    const { error } = alreadyVoted
      ? await supabase.from('community_share_votes').delete().eq('share_id', shareId).eq('user_id', userId)
      : await supabase.from('community_share_votes').insert({ share_id: shareId, user_id: userId });

    if (error) {
      set({ shares: previous, error: error.message });
    }
  },
}));
