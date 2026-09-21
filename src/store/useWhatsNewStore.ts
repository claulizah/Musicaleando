import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Novedad } from '../lib/whatsNew';

type WhatsNewState = {
  novedades: Novedad[];
  seenIds: string[];
  loadedFor: string | null;
  load: (userId: string) => Promise<void>;
  dismiss: (userId: string, novedadId: string) => void;
};

export const useWhatsNewStore = create<WhatsNewState>((set, get) => ({
  novedades: [],
  seenIds: [],
  loadedFor: null,

  load: async (userId) => {
    if (get().loadedFor === userId) return;
    set({ loadedFor: userId });
    const [{ data: novedades }, { data: vistas }] = await Promise.all([
      supabase
        .from('novedades')
        .select('id, pantalla, titulo, cuerpo, publicada_en, vigente_hasta, activa')
        .eq('activa', true),
      supabase.from('novedades_vistas').select('novedad_id').eq('user_id', userId),
    ]);
    set({ novedades: novedades ?? [], seenIds: (vistas ?? []).map((v) => v.novedad_id) });
  },

  // Se oculta al instante (optimista) y el registro va en segundo plano — si
  // falla, en el peor caso el aviso vuelve a salir una vez más, nunca se
  // bloquea la pantalla.
  dismiss: (userId, novedadId) => {
    set((s) => ({ seenIds: [...s.seenIds, novedadId] }));
    supabase
      .from('novedades_vistas')
      .upsert({ user_id: userId, novedad_id: novedadId }, { onConflict: 'user_id,novedad_id', ignoreDuplicates: true })
      .then(
        () => {},
        () => {},
      );
  },
}));
