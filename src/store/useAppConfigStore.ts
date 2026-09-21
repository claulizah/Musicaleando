import { create } from 'zustand';
import { supabase } from '../lib/supabase';

type AppConfigState = {
  affiliateTemplate: string | null;
  load: () => Promise<void>;
};

// Ajustes editables desde el admin sin release (tabla app_config). Se lee una
// vez al abrir la pantalla de eventos, en segundo plano: el botón de compra
// consulta este valor de forma síncrona, así que nunca espera a la red.
export const useAppConfigStore = create<AppConfigState>((set) => ({
  affiliateTemplate: null,
  load: async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'affiliate_url_template')
      .maybeSingle();
    set({ affiliateTemplate: data?.value?.trim() || null });
  },
}));
