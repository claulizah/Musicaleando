'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export type ApproveOverrides = {
  nombre: string;
  tipo: string; // '' | 'festival' | 'concierto' — '' se guarda como null (curador no lo confirmó)
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
  const tipo = overrides.tipo === 'festival' || overrides.tipo === 'concierto' ? overrides.tipo : null;
  const ciudad = overrides.ciudad.trim();
  const fecha_inicio = overrides.fecha_inicio.trim();
  // Ticketmaster casi nunca manda fecha de fin para shows de un solo día —
  // `festivals.fecha_fin` es NOT NULL, así que un evento de un día se
  // materializa con fecha_fin = fecha_inicio en vez de bloquear la
  // aprobación por un dato que la fuente típicamente no tiene.
  const fecha_fin = overrides.fecha_fin.trim() || fecha_inicio;
  const link_boletos = overrides.link_boletos.trim();

  if (!nombre || !ciudad || !fecha_inicio) {
    return { error: 'Faltan campos obligatorios (nombre, ciudad, fecha de inicio).' };
  }

  const supabase = await createClient();

  const { data: candidate, error: candidateError } = await supabase
    .from('event_candidates')
    .select('lineup, estado, source')
    .eq('id', candidateId)
    .maybeSingle();
  if (candidateError) return { error: candidateError.message };
  if (!candidate) return { error: 'El candidato ya no existe.' };
  if (candidate.estado === 'aprobado') return { error: 'Este candidato ya fue aprobado.' };
  // Ticketmaster siempre trae link de boletos real; un póster casi nunca —
  // solo se exige aquí para no perder ese dato cuando la fuente sí lo tiene.
  if (candidate.source === 'ticketmaster' && !link_boletos) {
    return { error: 'Falta el link de boletos.' };
  }

  const { data: festival, error: insertError } = await supabase
    .from('festivals')
    .insert({ nombre, tipo: tipo ?? 'festival', ciudad, fecha_inicio, fecha_fin, link_boletos: link_boletos || null })
    .select('id')
    .single();
  if (insertError) return { error: insertError.message };

  const lineup = candidate.lineup ?? [];
  if (lineup.length > 0) {
    const { error: lineupError } = await supabase.from('festival_lineup').insert(
      lineup.map((item) =>
        typeof item === 'string'
          ? { festival_id: festival.id, artista: item, escenario: null, horario: null }
          : { festival_id: festival.id, artista: item.artista, escenario: item.escenario, horario: item.horario },
      ),
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

// ---------- Agregar evento desde imagen (póster/flyer/line-up) ----------
// Misma idea que Ticketmaster: nunca se publica directo a `festivals`, todo
// entra a event_candidates como 'pendiente' salvo que el curador decida
// actualizar el line-up de un evento/candidato ya existente en vez de crear
// uno nuevo (ver mergeLineupIntoExisting).

export type ExtractedLineupItem = { artista: string; escenario: string | null; horario: string | null };

export type ExtractedEvent = {
  nombre: string | null;
  tipo: 'festival' | 'concierto' | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  ciudad: string | null;
  venue: string | null;
  lineup: ExtractedLineupItem[];
  esHorarioConTiempos: boolean;
};

export type DuplicateMatch = { type: 'festival' | 'candidate'; id: string; nombre: string };

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Mismo criterio de dedup que ticketmaster-sync (nombre normalizado que se
// contiene mutuamente + fecha dentro de 1 día + ciudad que se contiene
// mutuamente cuando ambas existen) — porteado a TS porque las Edge Functions
// (Deno) y los server actions de Next no comparten módulos en este repo. A
// diferencia del sync de Ticketmaster, aquí también se revisa contra otros
// candidatos pendientes (de cualquier fuente), no solo contra festivals ya
// aprobados — un póster puede describir el mismo evento que ya sincronizó
// Ticketmaster y sigue sin aprobarse.
function findDuplicateMatch(
  event: { nombre: string; ciudad: string | null; fecha_inicio: string | null },
  festivals: { id: string; nombre: string; ciudad: string; fecha_inicio: string }[],
  candidates: { id: string; nombre: string; ciudad: string | null; fecha_inicio: string | null }[],
): DuplicateMatch | null {
  const normName = normalizeText(event.nombre);

  const namesAndDatesMatch = (nombre: string, ciudad: string | null, fecha_inicio: string | null) => {
    const normOther = normalizeText(nombre);
    const namesMatch = normName === normOther || normName.includes(normOther) || normOther.includes(normName);
    if (!namesMatch) return false;
    if (event.fecha_inicio && fecha_inicio) {
      const diffDays = Math.abs(new Date(event.fecha_inicio).getTime() - new Date(fecha_inicio).getTime()) / 86_400_000;
      if (diffDays > 1) return false;
    }
    if (event.ciudad && ciudad) {
      const ciudadesMatch =
        normalizeText(event.ciudad).includes(normalizeText(ciudad)) ||
        normalizeText(ciudad).includes(normalizeText(event.ciudad));
      if (!ciudadesMatch) return false;
    }
    return true;
  };

  for (const f of festivals) {
    if (namesAndDatesMatch(f.nombre, f.ciudad, f.fecha_inicio)) {
      return { type: 'festival', id: f.id, nombre: f.nombre };
    }
  }
  for (const c of candidates) {
    if (namesAndDatesMatch(c.nombre, c.ciudad, c.fecha_inicio)) {
      return { type: 'candidate', id: c.id, nombre: c.nombre };
    }
  }
  return null;
}

// Solo extrae y revisa duplicados — no escribe nada. El curador decide en la
// UI qué hacer con el resultado (crear candidato nuevo, o actualizar el
// line-up de un evento/candidato existente).
export async function extractEventFromImage(
  imageBase64: string,
  mediaType: string,
): Promise<{ error?: string; extracted?: ExtractedEvent; duplicate?: DuplicateMatch | null }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{
    es_horario_con_tiempos: boolean;
    dia_label: string | null;
    bloques: { escenario: string | null; artista: string; hora_inicio: string | null; hora_fin: string | null }[];
    evento?: {
      nombre: string | null;
      tipo: 'festival' | 'concierto' | null;
      fecha_inicio: string | null;
      fecha_fin: string | null;
      ciudad: string | null;
      venue: string | null;
    };
    error?: string;
  }>('extract-lineup-image', { body: { image_base64: imageBase64, media_type: mediaType, extract_event_info: true } });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  if (!data?.evento) return { error: 'La IA no devolvió datos del evento. Intenta de nuevo o completa el formulario a mano.' };

  const extracted: ExtractedEvent = {
    nombre: data.evento.nombre,
    tipo: data.evento.tipo,
    fecha_inicio: data.evento.fecha_inicio,
    fecha_fin: data.evento.fecha_fin,
    ciudad: data.evento.ciudad,
    venue: data.evento.venue,
    lineup: (data.bloques ?? []).map((b) => ({
      artista: b.artista,
      escenario: b.escenario,
      horario: b.hora_inicio, // festival_lineup/event_candidates solo guardan un horario (inicio), igual que el importador existente
    })),
    esHorarioConTiempos: Boolean(data.es_horario_con_tiempos),
  };

  let duplicate: DuplicateMatch | null = null;
  if (extracted.nombre) {
    const [{ data: festivals }, { data: pendingCandidates }] = await Promise.all([
      supabase.from('festivals').select('id, nombre, ciudad, fecha_inicio'),
      supabase.from('event_candidates').select('id, nombre, ciudad, fecha_inicio').eq('estado', 'pendiente'),
    ]);
    duplicate = findDuplicateMatch(
      { nombre: extracted.nombre, ciudad: extracted.ciudad, fecha_inicio: extracted.fecha_inicio },
      festivals ?? [],
      pendingCandidates ?? [],
    );
  }

  return { extracted, duplicate };
}

export async function createEventCandidateFromImage(
  extracted: ExtractedEvent,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const nombre = (extracted.nombre ?? '').trim();
  if (!nombre) return { error: 'El evento necesita al menos un nombre.' };

  const supabase = await createClient();
  const { error } = await supabase.from('event_candidates').insert({
    source: 'poster_image',
    source_id: crypto.randomUUID(),
    nombre,
    tipo: extracted.tipo,
    ciudad: extracted.ciudad,
    venue: extracted.venue,
    fecha_inicio: extracted.fecha_inicio,
    fecha_fin: extracted.fecha_fin,
    lineup: extracted.lineup,
    completo: Boolean(extracted.nombre && extracted.ciudad && extracted.fecha_inicio),
    raw_payload: {},
    link_boletos: null,
    price_min: null,
    price_max: null,
    price_currency: null,
    possible_duplicate_of: null,
    festival_id: null,
  });
  if (error) return { error: error.message };

  revalidatePath('/candidatos');
  return {};
}

// El póster describe un evento que ya existe (festival aprobado o candidato
// pendiente) con un line-up más completo/actualizado — en vez de crear un
// duplicado, se agrega el line-up extraído al registro existente.
export async function mergeLineupIntoExisting(
  target: DuplicateMatch,
  lineup: ExtractedLineupItem[],
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };
  if (lineup.length === 0) return { error: 'No hay line-up para agregar.' };

  const supabase = await createClient();

  if (target.type === 'festival') {
    const { error } = await supabase.from('festival_lineup').insert(
      lineup.map((l) => ({
        festival_id: target.id,
        artista: l.artista,
        escenario: l.escenario,
        horario: l.horario,
      })),
    );
    if (error) return { error: error.message };
    revalidatePath(`/festivals/${target.id}`);
    return {};
  }

  // target.type === 'candidate' — el line-up extraído reemplaza al del
  // candidato (el póster se asume más completo/actualizado, mismo criterio
  // que pidió el prompt; no se intenta una fusión artista-por-artista).
  const { error } = await supabase
    .from('event_candidates')
    .update({ lineup, updated_at: new Date().toISOString() })
    .eq('id', target.id);
  if (error) return { error: error.message };

  revalidatePath('/candidatos');
  return {};
}
