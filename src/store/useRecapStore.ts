import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RecapData, RecapFoto } from '../lib/recap';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export type RecapFotoResolved = RecapFoto & { signedUrl: string | null };

type RecapState = {
  recap: RecapData | null;
  fotosResolved: RecapFotoResolved[];
  status: Status;
  error: string | null;
  fetch: (anio: number) => Promise<void>;
};

const SIGNED_URL_TTL_SECONDS = 3600;

export const useRecapStore = create<RecapState>((set) => ({
  recap: null,
  fotosResolved: [],
  status: 'idle',
  error: null,

  fetch: async (anio) => {
    set({ status: 'loading', error: null });

    const { data, error } = await supabase.rpc('get_recap_anual', { p_anio: anio });
    if (error) {
      set({ status: 'error', error: error.message });
      return;
    }

    const recap = data as unknown as RecapData;

    const fotosResolved = await Promise.all(
      recap.fotos.map(async (foto) => {
        const { data: signed } = await supabase.storage
          .from('concert-album')
          .createSignedUrl(foto.foto_path, SIGNED_URL_TTL_SECONDS);
        return { ...foto, signedUrl: signed?.signedUrl ?? null };
      }),
    );

    set({ recap, fotosResolved, status: 'ready' });
  },
}));
