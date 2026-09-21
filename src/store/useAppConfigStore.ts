import { create } from 'zustand';
import { supabase } from '../lib/supabase';

type AppConfigState = {
  affiliateTemplate: string | null;
  bannerDescuentos: string | null;
  load: () => Promise<void>;
};

// Ajustes editables desde el admin sin release (tabla app_config). Se leen una
// vez al abrir la pantalla de eventos, en segundo plano: el botón de compra
// consulta la plantilla de afiliado de forma síncrona, así que nunca espera a
// la red. bannerDescuentos es el aviso de descuentos que va arriba del catálogo.
export const useAppConfigStore = create<AppConfigState>((set) => ({
  affiliateTemplate: null,
  bannerDescuentos: null,
  load: async () => {
    const { data } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['affiliate_url_template', 'banner_descuentos']);
    const byKey = new Map((data ?? []).map((r) => [r.key, r.value?.trim() || null]));
    set({
      affiliateTemplate: byKey.get('affiliate_url_template') ?? null,
      bannerDescuentos: byKey.get('banner_descuentos') ?? null,
    });
  },
}));
