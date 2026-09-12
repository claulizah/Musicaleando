import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Tables } from '../types/database';

export type ContactRequest = Tables<'contacts'>;

export type BestMatch = {
  contact_user_id: string;
  nombre: string | null;
  arquetipo: string | null;
  compat_score: number | null;
};

export type ContactFeedEntry = {
  contact_user_id: string;
  nombre: string | null;
  arquetipo: string | null;
  generos: string[];
  ultimo_campeon_nombre: string | null;
  ultimo_campeon_fecha: string | null;
};

export type UserSearchResult = { user_id: string; nombre: string | null };

type Status = 'idle' | 'loading' | 'ready' | 'error';

type ContactsState = {
  userId: string | null;
  incoming: ContactRequest[];
  outgoing: ContactRequest[];
  accepted: ContactRequest[];
  feed: ContactFeedEntry[];
  bestMatch: BestMatch | null;
  status: Status;
  error: string | null;
  fetchAll: (userId: string) => Promise<void>;
  sendRequest: (contactId: string) => Promise<void>;
  respond: (requestId: string, accept: boolean) => Promise<void>;
  search: (query: string) => Promise<UserSearchResult[]>;
};

// contacts is a directed row (user_id = requester, contact_id = target), but
// the relationship itself is undirected once accepted — every read here has
// to check both directions to find "my" rows.
export const useContactsStore = create<ContactsState>((set, get) => ({
  userId: null,
  incoming: [],
  outgoing: [],
  accepted: [],
  feed: [],
  bestMatch: null,
  status: 'idle',
  error: null,

  fetchAll: async (userId) => {
    set({ status: 'loading', error: null, userId });

    const { data: rows, error } = await supabase
      .from('contacts')
      .select('*')
      .or(`user_id.eq.${userId},contact_id.eq.${userId}`);

    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    const incoming = (rows ?? []).filter((r) => r.status === 'pendiente' && r.contact_id === userId);
    const outgoing = (rows ?? []).filter((r) => r.status === 'pendiente' && r.user_id === userId);
    const accepted = (rows ?? []).filter((r) => r.status === 'aceptado');

    const [{ data: feed }, { data: bestMatchRows }] = await Promise.all([
      supabase.rpc('contacts_feed'),
      supabase.rpc('best_contact_match'),
    ]);

    set({
      incoming,
      outgoing,
      accepted,
      feed: (feed ?? []).map((f) => ({ ...f, generos: (f.generos as string[]) ?? [] })),
      bestMatch: bestMatchRows?.[0] ?? null,
      status: 'ready',
    });
  },

  sendRequest: async (contactId) => {
    const { error } = await supabase.rpc('send_contact_request', { p_contact_id: contactId });
    if (error) throw error;
    const userId = get().userId;
    if (userId) await get().fetchAll(userId);
  },

  respond: async (requestId, accept) => {
    const { error } = await supabase.rpc('respond_contact_request', {
      p_request_id: requestId,
      p_accept: accept,
    });
    if (error) throw error;
    const userId = get().userId;
    if (userId) await get().fetchAll(userId);
  },

  search: async (query) => {
    if (!query.trim()) return [];
    const { data, error } = await supabase.rpc('search_users_by_name', { p_query: query.trim() });
    if (error) throw error;
    return data ?? [];
  },
}));
