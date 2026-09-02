'use server';

import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export async function createFestival(
  formData: FormData,
): Promise<{ error: string } | never> {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return { error: 'No autorizado.' };
  }

  const nombre = String(formData.get('nombre') ?? '').trim();
  const ciudad = String(formData.get('ciudad') ?? '').trim();
  const fecha_inicio = String(formData.get('fecha_inicio') ?? '');
  const fecha_fin = String(formData.get('fecha_fin') ?? '');
  const link_boletos = String(formData.get('link_boletos') ?? '').trim() || null;

  if (!nombre || !ciudad || !fecha_inicio || !fecha_fin) {
    return { error: 'Nombre, ciudad y fechas son obligatorios.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('festivals')
    .insert({ nombre, ciudad, fecha_inicio, fecha_fin, link_boletos })
    .select('id')
    .single();

  if (error || !data) {
    return { error: error?.message ?? 'No se pudo crear el festival.' };
  }

  redirect(`/festivals/${data.id}`);
}
