'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export async function createSponsor(formData: FormData): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const nombre = String(formData.get('nombre') ?? '').trim();
  const contacto = String(formData.get('contacto') ?? '').trim() || null;
  const ofrece = String(formData.get('ofrece') ?? '').trim() || null;

  if (!nombre) return { error: 'El patrocinador necesita un nombre.' };

  const supabase = await createClient();
  const { error } = await supabase.from('sponsors').insert({ nombre, contacto, ofrece });

  if (error) return { error: error.message };

  revalidatePath('/sponsors');
  return {};
}

export async function deleteSponsor(sponsorId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('sponsors').delete().eq('id', sponsorId);

  if (error) return { error: error.message };

  revalidatePath('/sponsors');
  return {};
}
