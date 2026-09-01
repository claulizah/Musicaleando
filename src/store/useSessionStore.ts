import { create } from 'zustand';
import { ensureSession } from '../lib/supabase';

type SessionStatus = 'idle' | 'loading' | 'ready' | 'error';

type SessionState = {
  userId: string | null;
  status: SessionStatus;
  error: string | null;
  init: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  userId: null,
  status: 'idle',
  error: null,
  init: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      const userId = await ensureSession();
      set({ userId, status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
