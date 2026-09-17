'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveArtistIds } from '@/lib/artists';
import { cleanEventNameSafe } from '@/lib/cleanEventName';
import { normalizeHorario } from '@/lib/normalizeHorario';

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

  let lineup = candidate.lineup ?? [];
  // Ticketmaster siempre manda el headliner como "attraction" en lineup, pero
  // un candidato extraído de imagen/link a veces no devuelve bloques
  // explícitos para un concierto de un solo acto — ahí el nombre del evento
  // ES el artista, así que se sintetiza la única fila de line-up para que el
  // artista quede vinculado igual que en cualquier otro evento.
  if ((tipo ?? 'festival') === 'concierto' && lineup.length === 0) {
    lineup = [{ artista: nombre, escenario: null, horario: null }];
  }
  if (lineup.length > 0) {
    const artistIds = await resolveArtistIds(
      supabase,
      lineup.map((item) => (typeof item === 'string' ? item : item.artista)),
    );
    const { error: lineupError } = await supabase.from('festival_lineup').insert(
      lineup.map((item) => {
        const artista = typeof item === 'string' ? item : item.artista;
        const escenario = typeof item === 'string' ? null : item.escenario;
        const horario = typeof item === 'string' ? null : normalizeHorario(fecha_inicio, item.horario);
        return {
          festival_id: festival.id,
          artista,
          escenario,
          horario,
          artist_id: artistIds.get(artista) ?? null,
        };
      }),
    );
    if (lineupError) {
      // Un evento sin su line-up/artista vinculado no debe quedar publicado
      // en el catálogo público en silencio (bug real: esto pasaba y la
      // aprobación igual reportaba éxito) — se revierte el festival recién
      // creado y se reporta el error real; el candidato queda en 'pendiente'
      // tal como estaba, listo para reintentar.
      console.error('No se pudo insertar line-up al aprobar candidato — revirtiendo la aprobación:', lineupError);
      await supabase.from('festivals').delete().eq('id', festival.id);
      return { error: `No se pudo guardar el line-up (se revirtió la aprobación): ${lineupError.message}` };
    }
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

export type BulkApproveResult = { id: string; nombre: string; error?: string };

// Aprobar en bulk reusa approveCandidate ítem por ítem (misma validación,
// mismo vínculo con `artists`, mismo dedup) — nunca duplica esa lógica. Cada
// candidato se aprueba con SUS PROPIOS datos ya cargados (no un formulario
// editado a mano, eso sigue siendo el flujo individual); el único ajuste
// automático es la limpieza segura del nombre (cleanEventNameSafe), nunca
// una re-casing agresiva. Un candidato incompleto simplemente falla su
// propia validación dentro de approveCandidate y queda reportado como error
// sin bloquear el resto del lote.
export async function approveCandidatesBulk(candidateIds: string[]): Promise<{ results: BulkApproveResult[] }> {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return { results: candidateIds.map((id) => ({ id, nombre: id, error: 'No autorizado.' })) };
  }
  if (candidateIds.length === 0) return { results: [] };

  const supabase = await createClient();

  // Un solo .in() con cientos de IDs arma una URL GET larguísima del lado de
  // PostgREST — con un lote de ~767 esto devolvía "Bad Request" genérico
  // (nada de código/mensaje real de Postgres, porque el request ni llegaba a
  // Postgres) y por eso TODOS los ítems fallaban igual sin explicación. Se
  // trae en lotes chicos para evitar el límite de largo de URL.
  const FETCH_CHUNK_SIZE = 100;
  const byId = new Map<string, { id: string; nombre: string; tipo: string | null; ciudad: string | null; fecha_inicio: string | null; fecha_fin: string | null; link_boletos: string | null }>();
  const fetchErrorById = new Map<string, string>();

  for (let i = 0; i < candidateIds.length; i += FETCH_CHUNK_SIZE) {
    const chunk = candidateIds.slice(i, i + FETCH_CHUNK_SIZE);
    const { data: rows, error: fetchError } = await supabase
      .from('event_candidates')
      .select('id, nombre, tipo, ciudad, fecha_inicio, fecha_fin, link_boletos')
      .in('id', chunk);

    if (fetchError) {
      console.error(`No se pudieron leer ${chunk.length} candidatos para aprobación en bulk:`, fetchError);
      for (const id of chunk) fetchErrorById.set(id, fetchError.message);
      continue;
    }
    for (const r of rows ?? []) byId.set(r.id, r);
  }

  const results: BulkApproveResult[] = [];

  for (const id of candidateIds) {
    if (fetchErrorById.has(id)) {
      results.push({ id, nombre: id, error: fetchErrorById.get(id) });
      continue;
    }
    const row = byId.get(id);
    if (!row) {
      results.push({ id, nombre: '(candidato no encontrado)', error: 'El candidato ya no existe.' });
      continue;
    }
    const overrides: ApproveOverrides = {
      nombre: cleanEventNameSafe(row.nombre),
      tipo: row.tipo === 'festival' || row.tipo === 'concierto' ? row.tipo : '',
      ciudad: row.ciudad ?? '',
      fecha_inicio: row.fecha_inicio ?? '',
      fecha_fin: row.fecha_fin ?? '',
      link_boletos: row.link_boletos ?? '',
    };
    const result = await approveCandidate(id, overrides);
    if (result.error) {
      // Mismo nivel de detalle que approveCandidate individual — antes acá
      // no quedaba ningún rastro del motivo real por ítem, solo se veía que
      // la función bulk había corrido.
      console.error(`approveCandidatesBulk: candidato ${id} (${row.nombre}) falló:`, result.error);
    }
    results.push({ id, nombre: row.nombre, error: result.error });
  }

  return { results };
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

export type BulkRejectResult = { id: string; nombre: string; error?: string };

// Mismo patrón que approveCandidatesBulk: trae los nombres en chunks (evita
// el mismo problema de URL demasiado larga con lotes grandes) y reusa
// discardCandidate ítem por ítem en vez de duplicar la lógica.
export async function discardCandidatesBulk(candidateIds: string[]): Promise<{ results: BulkRejectResult[] }> {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return { results: candidateIds.map((id) => ({ id, nombre: id, error: 'No autorizado.' })) };
  }
  if (candidateIds.length === 0) return { results: [] };

  const supabase = await createClient();
  const FETCH_CHUNK_SIZE = 100;
  const nombreById = new Map<string, string>();

  for (let i = 0; i < candidateIds.length; i += FETCH_CHUNK_SIZE) {
    const chunk = candidateIds.slice(i, i + FETCH_CHUNK_SIZE);
    const { data: rows, error: fetchError } = await supabase
      .from('event_candidates')
      .select('id, nombre')
      .in('id', chunk);
    if (fetchError) {
      console.error(`No se pudieron leer ${chunk.length} candidatos para rechazo en bulk:`, fetchError);
      continue;
    }
    for (const r of rows ?? []) nombreById.set(r.id, r.nombre);
  }

  const results: BulkRejectResult[] = [];
  for (const id of candidateIds) {
    const nombre = nombreById.get(id) ?? id;
    const result = await discardCandidate(id);
    if (result.error) console.error(`discardCandidatesBulk: candidato ${id} (${nombre}) falló:`, result.error);
    results.push({ id, nombre, error: result.error });
  }

  return { results };
}

// ---------- Deshacer (ventana corta tras aprobar/rechazar) ----------
// No hay historial de auditoría completo aquí — solo revierte la acción
// inmediata anterior, mientras el toast de "Deshacer" sigue visible.

export async function undoDiscard(candidateId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('event_candidates')
    .update({ estado: 'pendiente' })
    .eq('id', candidateId)
    .eq('estado', 'descartado'); // no revive algo que ya cambió de estado por otra vía mientras tanto

  if (error) return { error: error.message };
  revalidatePath('/candidatos');
  return {};
}

export async function undoDiscardBulk(candidateIds: string[]): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };
  if (candidateIds.length === 0) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from('event_candidates')
    .update({ estado: 'pendiente' })
    .in('id', candidateIds)
    .eq('estado', 'descartado');

  if (error) return { error: error.message };
  revalidatePath('/candidatos');
  return {};
}

// Deshacer una aprobación es más delicado: ya se creó `festivals` +
// `festival_lineup` + posibles `artists` nuevos. Decisión de alcance (ver
// reporte del ticket): se borran festival_lineup y festivals (lo que esta
// aprobación específica creó, identificable sin ambigüedad vía
// event_candidates.festival_id) y el candidato vuelve a 'pendiente'. Los
// `artists` que se hayan creado/reusado en el proceso NO se borran — un
// artista puede estar compartido con otro evento ya aprobado, y una fila de
// más en `artists` no es "dato a medias" (es solo un nombre sin usar), a
// diferencia de un festival fantasma sin dueño. Esto no defiende contra algo
// que ya haya empezado a depender de ese festival en la ventana de ~30s
// (ej. un squad creado con ese festival) — ventana corta y acción deliberada
// de la curadora, no un rollback transaccional real.
export async function undoApprove(candidateId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { data: candidate, error: fetchError } = await supabase
    .from('event_candidates')
    .select('estado, festival_id')
    .eq('id', candidateId)
    .maybeSingle();
  if (fetchError) return { error: fetchError.message };
  if (!candidate || candidate.estado !== 'aprobado' || !candidate.festival_id) {
    return { error: 'Este candidato ya no está en un estado que se pueda deshacer.' };
  }

  const { error: lineupDeleteError } = await supabase
    .from('festival_lineup')
    .delete()
    .eq('festival_id', candidate.festival_id);
  if (lineupDeleteError) return { error: lineupDeleteError.message };

  const { error: festivalDeleteError } = await supabase.from('festivals').delete().eq('id', candidate.festival_id);
  if (festivalDeleteError) return { error: festivalDeleteError.message };

  const { error: updateError } = await supabase
    .from('event_candidates')
    .update({ estado: 'pendiente', festival_id: null })
    .eq('id', candidateId);
  if (updateError) return { error: updateError.message };

  revalidatePath('/candidatos');
  revalidatePath('/admin');
  return {};
}

export type UndoApproveResult = { id: string; error?: string };

export async function undoApproveBulk(candidateIds: string[]): Promise<{ results: UndoApproveResult[] }> {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return { results: candidateIds.map((id) => ({ id, error: 'No autorizado.' })) };
  }

  const results: UndoApproveResult[] = [];
  for (const id of candidateIds) {
    const result = await undoApprove(id);
    results.push({ id, error: result.error });
  }
  return { results };
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

export async function createEventCandidate(
  extracted: ExtractedEvent,
  source: 'poster_image' | 'link',
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const nombre = (extracted.nombre ?? '').trim();
  if (!nombre) return { error: 'El evento necesita al menos un nombre.' };

  const supabase = await createClient();
  const { error } = await supabase.from('event_candidates').insert({
    source,
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
    const { data: targetFestival } = await supabase
      .from('festivals')
      .select('fecha_inicio')
      .eq('id', target.id)
      .maybeSingle();
    const artistIds = await resolveArtistIds(supabase, lineup.map((l) => l.artista));
    const { error } = await supabase.from('festival_lineup').insert(
      lineup.map((l) => ({
        festival_id: target.id,
        artista: l.artista,
        escenario: l.escenario,
        horario: targetFestival ? normalizeHorario(targetFestival.fecha_inicio, l.horario) : null,
        artist_id: artistIds.get(l.artista) ?? null,
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

// ---------- Agregar evento desde link ----------
// Mismo contrato de salida que extractEventFromImage (ExtractedEvent +
// posible duplicado) para que la UI comparta el mismo componente de
// preview/aprobación — solo cambia de dónde sale el JSON crudo (Edge
// Function que lee una URL puntual en vez de una imagen).
export type ExtractedEventWithDuplicate = ExtractedEvent & { duplicate: DuplicateMatch | null };

// Handles both a single-event page and a listing/cartelera page with one
// call — the Edge Function always returns an array (length 1 for a normal
// event page), so the UI just branches on how many came back instead of
// needing a separate "is this a listing" step.
export async function extractEventFromLink(
  url: string,
): Promise<{ error?: string; events?: ExtractedEventWithDuplicate[]; esListado?: boolean }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{
    esListado?: boolean;
    eventos?: {
      nombre: string | null;
      tipo: 'festival' | 'concierto' | null;
      fecha_inicio: string | null;
      fecha_fin: string | null;
      ciudad: string | null;
      venue: string | null;
      bloques: { escenario: string | null; artista: string; hora_inicio: string | null }[];
    }[];
    error?: string;
  }>('extract-event-from-link', { body: { url } });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  if (!data?.eventos || data.eventos.length === 0) {
    return { error: 'La IA no encontró ningún evento en esa página. Completa el formulario a mano.' };
  }

  const extracted: ExtractedEvent[] = data.eventos.map((e) => ({
    nombre: e.nombre,
    tipo: e.tipo,
    fecha_inicio: e.fecha_inicio,
    fecha_fin: e.fecha_fin,
    ciudad: e.ciudad,
    venue: e.venue,
    lineup: (e.bloques ?? []).map((b) => ({ artista: b.artista, escenario: b.escenario, horario: b.hora_inicio })),
    esHorarioConTiempos: (e.bloques ?? []).some((b) => Boolean(b.hora_inicio)),
  }));

  // One fetch of festivals/pending-candidates, reused for every event's
  // dedup check — a listing page can propose dozens of events, no reason to
  // re-query the same two tables that many times.
  const [{ data: festivals }, { data: pendingCandidates }] = await Promise.all([
    supabase.from('festivals').select('id, nombre, ciudad, fecha_inicio'),
    supabase.from('event_candidates').select('id, nombre, ciudad, fecha_inicio').eq('estado', 'pendiente'),
  ]);

  const events: ExtractedEventWithDuplicate[] = extracted.map((ev) => ({
    ...ev,
    duplicate: ev.nombre
      ? findDuplicateMatch({ nombre: ev.nombre, ciudad: ev.ciudad, fecha_inicio: ev.fecha_inicio }, festivals ?? [], pendingCandidates ?? [])
      : null,
  }));

  return { events, esListado: Boolean(data.esListado) };
}

// Bulk version of createEventCandidate — used when the curator selects
// several events from a listing page at once. Each insert is independent
// (one bad row doesn't block the rest), and results are reported per event
// so the UI can show which ones actually landed in /candidatos.
export async function createEventCandidates(
  events: ExtractedEvent[],
  source: 'poster_image' | 'link',
): Promise<{ created: number; errors: string[] }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { created: 0, errors: ['No autorizado.'] };

  let created = 0;
  const errors: string[] = [];
  for (const event of events) {
    const result = await createEventCandidate(event, source);
    if (result.error) errors.push(`${event.nombre ?? '(sin nombre)'}: ${result.error}`);
    else created++;
  }
  return { created, errors };
}
