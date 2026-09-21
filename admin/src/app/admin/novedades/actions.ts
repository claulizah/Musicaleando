'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NOVEDAD_PANTALLAS } from '@/lib/novedades';

export async function createNovedad(input: {
  id: string;
  pantalla: string;
  titulo: string;
  cuerpo: string;
  vigente_hasta: string;
}): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const id = input.id.trim().toLowerCase();
  const titulo = input.titulo.trim();
  const cuerpo = input.cuerpo.trim();
  if (!/^[a-z0-9_-]{3,40}$/.test(id)) {
    return { error: 'El identificador debe tener 3–40 caracteres: letras minúsculas, números, guion o guion bajo (ej. squads-v2).' };
  }
  if (!NOVEDAD_PANTALLAS.some((p) => p.id === input.pantalla)) return { error: 'Pantalla inválida.' };
  if (!titulo || !cuerpo) return { error: 'Título y texto son obligatorios.' };

  let vigente_hasta: string | null = null;
  if (input.vigente_hasta) {
    const d = new Date(input.vigente_hasta + 'T23:59:59-06:00');
    if (Number.isNaN(d.getTime())) return { error: 'Fecha de vigencia inválida.' };
    vigente_hasta = d.toISOString();
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('novedades')
    .insert({ id, pantalla: input.pantalla, titulo, cuerpo, vigente_hasta });
  if (error) {
    return { error: error.code === '23505' ? 'Ya existe un aviso con ese identificador.' : error.message };
  }
  revalidatePath('/admin/novedades');
  return {};
}

export async function setNovedadActiva(id: string, activa: boolean): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };
  const supabase = await createClient();
  const { error } = await supabase.from('novedades').update({ activa }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/novedades');
  return {};
}

export async function deleteNovedad(id: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };
  const supabase = await createClient();
  const { error } = await supabase.from('novedades').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/novedades');
  return {};
}
