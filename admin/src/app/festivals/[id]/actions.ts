'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveArtistIds } from '@/lib/artists';
import { normalizeHorario } from '@/lib/normalizeHorario';
import { logAdminAction } from '@/lib/adminActionsLog';

export type LineupRow = {
  artista: string;
  escenario: string | null;
  horario: string | null;
};

export async function updateLinkBoletos(
  festivalId: string,
  linkBoletos: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('festivals')
    .update({ link_boletos: linkBoletos.trim() || null })
    .eq('id', festivalId);

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

export async function updateTipo(
  festivalId: string,
  tipo: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  if (tipo !== 'festival' && tipo !== 'concierto') {
    return { error: 'Tipo inválido.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('festivals').update({ tipo }).eq('id', festivalId);

  if (error) return { error: error.message };

  await logAdminAction(supabase, admin.userId, 'editar', 'festival', festivalId, { detail: { campo: 'tipo', valor: tipo } });
  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

// Archivar/restaurar a mano. El archivado automático corre a diario (ver
// migración archive_past_festivals); esto permite reactivar un evento que se
// archivó por una fecha mal capturada, o archivar uno cancelado antes de
// tiempo — nunca borra nada.
export async function updateEstadoEvento(
  festivalId: string,
  estado: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  if (estado !== 'activo' && estado !== 'archivado') {
    return { error: 'Estado inválido.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('festivals').update({ estado_evento: estado }).eq('id', festivalId);
  if (error) return { error: error.message };

  await logAdminAction(supabase, admin.userId, 'editar', 'festival', festivalId, {
    detail: { campo: 'estado_evento', valor: estado },
  });
  revalidatePath(`/festivals/${festivalId}`);
  revalidatePath('/admin');
  return {};
}

// El catálogo aprobado solo dejaba editar tipo y link_boletos — nombre,
// ciudad y fechas quedaban fijos desde que se aprobó el candidato, sin forma
// de corregirlos si el dato llegó mal (ej. el bug de ciudad="México"
// genérico de Ticketmaster, corregido antes con una migración puntual
// porque no había otra forma de arreglarlo desde el admin).
export async function updateEventDetails(
  festivalId: string,
  fields: { nombre: string; ciudad: string; fecha_inicio: string; fecha_fin: string },
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const nombre = fields.nombre.trim();
  const ciudad = fields.ciudad.trim();
  if (!nombre || !ciudad || !fields.fecha_inicio || !fields.fecha_fin) {
    return { error: 'Nombre, ciudad y ambas fechas son obligatorios.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('festivals')
    .update({ nombre, ciudad, fecha_inicio: fields.fecha_inicio, fecha_fin: fields.fecha_fin })
    .eq('id', festivalId);

  if (error) return { error: error.message };

  await logAdminAction(supabase, admin.userId, 'editar', 'festival', festivalId, {
    detail: { campo: 'detalles', nombre, ciudad, fecha_inicio: fields.fecha_inicio, fecha_fin: fields.fecha_fin },
  });
  revalidatePath(`/festivals/${festivalId}`);
  revalidatePath('/admin');
  return {};
}

export async function importLineup(
  festivalId: string,
  rows: LineupRow[],
): Promise<{ error?: string; imported?: number }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const validRows = rows
    .map((r) => ({ ...r, artista: r.artista.trim() }))
    .filter((r) => r.artista.length > 0);

  if (validRows.length === 0) {
    return { error: 'El CSV no tiene filas válidas (falta la columna "artista").' };
  }

  const supabase = await createClient();
  const { data: festival } = await supabase
    .from('festivals')
    .select('fecha_inicio')
    .eq('id', festivalId)
    .maybeSingle();
  const artistIds = await resolveArtistIds(supabase, validRows.map((r) => r.artista));
  const { error } = await supabase.from('festival_lineup').insert(
    validRows.map((r) => ({
      festival_id: festivalId,
      artista: r.artista,
      escenario: r.escenario?.trim() || null,
      horario: festival ? normalizeHorario(festival.fecha_inicio, r.horario?.trim() || null) : null,
      artist_id: artistIds.get(r.artista) ?? null,
    })),
  );

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return { imported: validRows.length };
}

export async function deleteLineupRow(festivalId: string, rowId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('festival_lineup').delete().eq('id', rowId);

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

// Mínimo de agregación ya definido en el spec para cualquier reporte/segmento
// vendible a patrocinadores (alineado con LFPDPPP) — se reutiliza aquí como
// piso para publicar un anuncio segmentado, no solo para reportes.
const MIN_SEGMENT_SIZE = 30;

export async function estimateSegmentAudience(
  festivalId: string,
  ciudad: string,
  genero: string,
): Promise<{ error?: string; count?: number }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('count_segment_audience', {
    p_festival_id: festivalId,
    p_ciudad: ciudad.trim() || null,
    p_genero: genero.trim() || null,
  });

  if (error) return { error: error.message };
  return { count: data ?? 0 };
}

export async function createAnnouncement(
  festivalId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const tipo = String(formData.get('tipo') ?? '');
  const titulo = String(formData.get('titulo') ?? '').trim();
  const descripcion = String(formData.get('descripcion') ?? '').trim() || null;
  const sponsor_nombre = String(formData.get('sponsor_nombre') ?? '').trim() || null;
  const codigo_descuento = String(formData.get('codigo_descuento') ?? '').trim() || null;
  const target_ciudad = String(formData.get('target_ciudad') ?? '').trim() || null;
  const target_genero = String(formData.get('target_genero') ?? '').trim() || null;

  if (!['simple', 'rifa', 'descuento'].includes(tipo)) {
    return { error: 'Tipo de anuncio inválido.' };
  }
  if (!titulo) return { error: 'El anuncio necesita un título.' };

  const supabase = await createClient();

  // Un anuncio sin ciudad/género es para toda la audiencia — el mínimo de
  // agregación solo aplica cuando de verdad se está acotando un segmento.
  if (target_ciudad || target_genero) {
    const { data: audienceCount, error: countError } = await supabase.rpc('count_segment_audience', {
      p_festival_id: festivalId,
      p_ciudad: target_ciudad,
      p_genero: target_genero,
    });
    if (countError) return { error: countError.message };
    if ((audienceCount ?? 0) < MIN_SEGMENT_SIZE) {
      return {
        error: `Este segmento tiene solo ${audienceCount ?? 0} usuarios — el mínimo para publicar un anuncio acotado es ${MIN_SEGMENT_SIZE}. Amplía el segmento o quita el filtro.`,
      };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('announcements').insert({
    festival_id: festivalId,
    tipo,
    titulo,
    descripcion,
    sponsor_nombre,
    codigo_descuento: tipo === 'descuento' ? codigo_descuento : null,
    created_by: user?.id ?? null,
    target_ciudad,
    target_genero,
  });

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

// Cubre el caso de "anuncio ya activo al que se le reduce el segmento
// después" — un anuncio publicado no tiene estado borrador/activo (insertar
// = publicar), así que la única forma de que su segmento cambie es editando
// target_ciudad/target_genero ya con el anuncio existiendo. Revalida con la
// misma regla que crear, nunca se permite guardar un segmento angosto.
export async function updateAnnouncementSegment(
  festivalId: string,
  announcementId: string,
  targetCiudadInput: string,
  targetGeneroInput: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const target_ciudad = targetCiudadInput.trim() || null;
  const target_genero = targetGeneroInput.trim() || null;

  const supabase = await createClient();

  if (target_ciudad || target_genero) {
    const { data: audienceCount, error: countError } = await supabase.rpc('count_segment_audience', {
      p_festival_id: festivalId,
      p_ciudad: target_ciudad,
      p_genero: target_genero,
    });
    if (countError) return { error: countError.message };
    if ((audienceCount ?? 0) < MIN_SEGMENT_SIZE) {
      return {
        error: `Este segmento tiene solo ${audienceCount ?? 0} usuarios — el mínimo para mantener un anuncio acotado es ${MIN_SEGMENT_SIZE}. Amplía el segmento o quita el filtro.`,
      };
    }
  }

  const { error } = await supabase
    .from('announcements')
    .update({ target_ciudad, target_genero })
    .eq('id', announcementId);
  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

// Picking a winner needs to read a random announcement_interest row and
// resolve the winner's nombre from `users` — but `users` only has a
// select-own RLS policy, so even an authenticated admin session can't read
// another user's nombre directly. select_raffle_winner is a SECURITY DEFINER
// RPC (checks is_admin itself) that does the pick + name lookup + write in
// one step, same shape as every other RLS gap fixed this session.
export async function selectRaffleWinner(
  festivalId: string,
  announcementId: string,
): Promise<{ error?: string; ganadorNombre?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc('select_raffle_winner', { p_announcement_id: announcementId })
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return { ganadorNombre: data?.ganador_nombre ?? undefined };
}

export async function deleteAnnouncement(
  festivalId: string,
  announcementId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('announcements').delete().eq('id', announcementId);

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

export type LineupCandidate = {
  id: string;
  batch_id: string;
  dia_label: string | null;
  escenario: string | null;
  artista: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  confianza: string;
  nota: string | null;
};

// Sends the image to Claude (vision, via the extract-lineup-image Edge
// Function) and stores whatever it returns as pendiente candidates — nothing
// touches festival_lineup here. Real cost per call (Anthropic billing), so
// this only runs when the admin explicitly uploads an image, never in bulk.
export async function extractLineupFromImage(
  festivalId: string,
  imageBase64: string,
  mediaType: string,
): Promise<{ error?: string; batchId?: string; count?: number; esHorarioConTiempos?: boolean }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{
    es_horario_con_tiempos: boolean;
    dia_label: string | null;
    bloques: {
      escenario: string | null;
      artista: string;
      hora_inicio: string | null;
      hora_fin: string | null;
      confianza: string;
      nota: string | null;
    }[];
    error?: string;
  }>('extract-lineup-image', { body: { image_base64: imageBase64, media_type: mediaType } });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  const bloques = data?.bloques ?? [];
  if (bloques.length === 0) {
    return { error: 'No se detectó ningún artista en la imagen.', esHorarioConTiempos: data?.es_horario_con_tiempos };
  }

  const batchId = crypto.randomUUID();
  const { error: insertError } = await supabase.from('festival_lineup_candidates').insert(
    bloques.map((b) => ({
      festival_id: festivalId,
      batch_id: batchId,
      dia_label: data?.dia_label ?? null,
      escenario: b.escenario,
      artista: b.artista,
      hora_inicio: b.hora_inicio,
      hora_fin: b.hora_fin,
      confianza: (['alta', 'media', 'baja'].includes(b.confianza) ? b.confianza : 'baja') as
        | 'alta'
        | 'media'
        | 'baja',
      nota: b.nota,
    })),
  );

  if (insertError) return { error: insertError.message };

  revalidatePath(`/festivals/${festivalId}`);
  return { batchId, count: bloques.length, esHorarioConTiempos: data?.es_horario_con_tiempos };
}

export async function approveLineupCandidate(
  festivalId: string,
  candidateId: string,
  values: { artista: string; escenario: string | null; horario: string | null },
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const artista = values.artista.trim();
  if (!artista) return { error: 'Falta el nombre del artista.' };

  const supabase = await createClient();
  const { data: festival } = await supabase
    .from('festivals')
    .select('fecha_inicio')
    .eq('id', festivalId)
    .maybeSingle();
  const artistIds = await resolveArtistIds(supabase, [artista]);
  const { error: insertError } = await supabase.from('festival_lineup').insert({
    festival_id: festivalId,
    artista,
    escenario: values.escenario?.trim() || null,
    horario: festival ? normalizeHorario(festival.fecha_inicio, values.horario) : null,
    artist_id: artistIds.get(artista) ?? null,
  });
  if (insertError) return { error: insertError.message };

  const { error: deleteError } = await supabase
    .from('festival_lineup_candidates')
    .delete()
    .eq('id', candidateId);
  if (deleteError) return { error: deleteError.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

export async function discardLineupCandidate(
  festivalId: string,
  candidateId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('festival_lineup_candidates').delete().eq('id', candidateId);
  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

export async function discardLineupBatch(festivalId: string, batchId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('festival_lineup_candidates').delete().eq('batch_id', batchId);
  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

// The image itself is uploaded client-side straight to Storage (see
// map-uploader.tsx) — this action only persists the resulting public URL,
// so it stays consistent with every other write in this app going through
// requireAdmin() + a server action.
export async function updateMapaUrl(festivalId: string, mapaUrl: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('festivals').update({ mapa_url: mapaUrl }).eq('id', festivalId);

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

export async function addMapPin(
  festivalId: string,
  escenario: string,
  xPct: number,
  yPct: number,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const trimmed = escenario.trim();
  if (!trimmed) return { error: 'El pin necesita un nombre de escenario.' };

  const supabase = await createClient();
  const { error } = await supabase.from('festival_map_pins').insert({
    festival_id: festivalId,
    escenario: trimmed,
    x_pct: Math.round(xPct * 100) / 100,
    y_pct: Math.round(yPct * 100) / 100,
  });

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}

export async function deleteMapPin(festivalId: string, pinId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase.from('festival_map_pins').delete().eq('id', pinId);

  if (error) return { error: error.message };

  revalidatePath(`/festivals/${festivalId}`);
  return {};
}
