'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

const KEY = 'banner_descuentos';
const MAX_LENGTH = 200;

// Banner de descuentos que la app muestra arriba del catálogo de eventos (ej.
// "Jueves de 2x1: aplica con ciertos bancos y varía por evento"). Vacío =
// sin banner. Es texto libre porque la regla real depende del banco/tarjeta y
// cambia por evento; se edita aquí sin release de la app.
export async function saveBannerDescuentos(value: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const text = value.trim();
  if (text.length > MAX_LENGTH) return { error: `El banner no puede pasar de ${MAX_LENGTH} caracteres.` };

  const supabase = await createClient();
  if (!text) {
    const { error } = await supabase.from('app_config').delete().eq('key', KEY);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: KEY, value: text, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return { error: error.message };
  }

  revalidatePath('/admin/descuentos');
  return {};
}
