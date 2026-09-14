'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export type ApproveOverrides = {
  nombre: string;
  ciudad: string;
  fecha_inicio: string;
  fecha_fin: string;
  link_boletos: string;
};

// Un solo paso: si el candidato ya está completo el form no manda overrides
// (usa los valores tal cual llegaron del sync); si falta algo, el admin los
// edita en el mismo formulario y este action los usa en vez de los
// originales. En ambos casos, aprobar = materializar en `festivals` (y, si
// hay line-up, en `festival_lineup`) + marcar el candidato como 'aprobado'.
export async function approveCandidate(
  candidateId: string,
  overrides: ApproveOverrides,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const nombre = overrides.nombre.trim();
  const ciudad = overrides.ciudad.trim();
  const fecha_inicio = overrides.fecha_inicio.trim();
  // Ticketmaster casi nunca manda fecha de fin para shows de un solo día —
  // `festivals.fecha_fin` es NOT NULL, así que un evento de un día se
  // materializa con fecha_fin = fecha_inicio en vez de bloquear la
  // aprobación por un dato que la fuente típicamente no tiene.
  const fecha_fin = overrides.fecha_fin.trim() || fecha_inicio;
  const link_boletos = overrides.link_boletos.trim();

  if (!nombre || !ciudad || !fecha_inicio || !link_boletos) {
    return { error: 'Faltan campos obligatorios (nombre, ciudad, fecha de inicio, link de boletos).' };
  }

  const supabase = await createClient();

  const { data: candidate, error: candidateError } = await supabase
    .from('event_candidates')
    .select('lineup, estado')
    .eq('id', candidateId)
    .maybeSingle();
  if (candidateError) return { error: candidateError.message };
  if (!candidate) return { error: 'El candidato ya no existe.' };
  if (candidate.estado === 'aprobado') return { error: 'Este candidato ya fue aprobado.' };

  const { data: festival, error: insertError } = await supabase
    .from('festivals')
    .insert({ nombre, ciudad, fecha_inicio, fecha_fin, link_boletos })
    .select('id')
    .single();
  if (insertError) return { error: insertError.message };

  const lineup = (candidate.lineup as string[] | null) ?? [];
  if (lineup.length > 0) {
    const { error: lineupError } = await supabase.from('festival_lineup').insert(
      lineup.map((artista) => ({ festival_id: festival.id, artista, escenario: null, horario: null })),
    );
    // Un fallo aquí no debe dejar el candidato en un estado ambiguo — el
    // festival ya existe y es lo que importa; el line-up se puede completar
    // a mano después desde el detalle del festival.
    if (lineupError) console.error('No se pudo insertar line-up al aprobar candidato:', lineupError);
  }

  const { error: updateError } = await supabase
    .from('event_candidates')
    .update({ estado: 'aprobado', festival_id: festival.id })
    .eq('id', candidateId);
  if (updateError) return { error: updateError.message };

  revalidatePath('/candidatos');
  revalidatePath('/admin');
  return {};
}

export async function discardCandidate(candidateId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('event_candidates')
    .update({ estado: 'descartado' })
    .eq('id', candidateId);
  if (error) return { error: error.message };

  revalidatePath('/candidatos');
  return {};
}
