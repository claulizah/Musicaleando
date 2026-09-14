import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { resetLocalState } from '../lib/resetLocalState';

type Status = 'idle' | 'loading' | 'error';

type AccountState = {
  status: Status;
  error: string | null;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

function describeError(err: unknown, action: 'cerrar sesión' | 'eliminar la cuenta'): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/network|fetch/i.test(raw)) {
    return `No hay conexión a internet. No se pudo ${action} — intenta de nuevo cuando tengas señal.`;
  }
  return `No se pudo ${action} (${raw}). Intenta de nuevo o contáctanos si el problema sigue.`;
}

export const useAccountStore = create<AccountState>((set) => ({
  status: 'idle',
  error: null,

  signOut: async () => {
    set({ status: 'loading', error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await resetLocalState();
      set({ status: 'idle', error: null });
    } catch (err) {
      const message = describeError(err, 'cerrar sesión');
      set({ status: 'error', error: message });
      throw new Error(message);
    }
  },

  // The client never touches auth.users or any personal-data table directly
  // — it only asks the "delete-account" Edge Function to do it server-side
  // with the service role key, scoped to the caller's own JWT. Local state
  // is only torn down after the server confirms the account is gone, so a
  // failed/offline call leaves the session exactly as it was (no
  // intermediate "half-deleted" state on this device).
  deleteAccount: async () => {
    set({ status: 'loading', error: null });
    try {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw error;
      await supabase.auth.signOut();
      await resetLocalState();
      set({ status: 'idle', error: null });
    } catch (err) {
      const message = describeError(err, 'eliminar la cuenta');
      set({ status: 'error', error: message });
      throw new Error(message);
    }
  },
}));
