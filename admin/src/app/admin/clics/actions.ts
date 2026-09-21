'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

const KEY = 'affiliate_url_template';

// Plantilla del link de afiliado. Vacía = sin afiliado (la app abre el link
// original). Se valida aquí porque una plantilla mal escrita rompería el
// botón de compra de TODOS los usuarios sin necesidad de release para
// arreglarlo — la app además la ignora si no cumple estas mismas reglas.
export async function saveAffiliateTemplate(value: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const template = value.trim();
  const supabase = await createClient();

  if (!template) {
    const { error } = await supabase.from('app_config').delete().eq('key', KEY);
    if (error) return { error: error.message };
    revalidatePath('/admin/clics');
    return {};
  }

  if (!template.startsWith('https://')) return { error: 'La plantilla debe empezar con https://' };
  if (!template.includes('{url}')) {
    return { error: 'Falta {url} — ahí se inserta el link original del evento (ej. https://…/c/123/456/789?u={url}).' };
  }

  const { error } = await supabase
    .from('app_config')
    .upsert({ key: KEY, value: template, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return { error: error.message };

  revalidatePath('/admin/clics');
  return {};
}
