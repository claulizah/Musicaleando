'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export type NameCleanupUpdate = { id: string; nombre: string };

// Aplica el pase de limpieza segura a los festivales que la curadora
// confirmó en la pantalla de revisión (nunca en silencio) — un update por
// fila, sin re-casing ni separación de ciudad/año, exactamente lo que ya
// vio en el antes/después.
export async function applyNameCleanup(updates: NameCleanupUpdate[]): Promise<{ error?: string; updated?: number }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };
  if (updates.length === 0) return { updated: 0 };

  const supabase = await createClient();
  let updated = 0;
  const errors: string[] = [];

  for (const u of updates) {
    const nombre = u.nombre.trim();
    if (!nombre) continue;
    const { error } = await supabase.from('festivals').update({ nombre }).eq('id', u.id);
    if (error) errors.push(`${u.id}: ${error.message}`);
    else updated++;
  }

  revalidatePath('/candidatos/limpieza');
  revalidatePath('/admin');

  if (errors.length > 0) return { error: errors.join(' | '), updated };
  return { updated };
}
