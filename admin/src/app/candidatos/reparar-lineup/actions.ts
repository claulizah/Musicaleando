'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveArtistIds } from '@/lib/artists';
import { normalizeHorario } from '@/lib/normalizeHorario';

// Los 13 festivales identificados en prompt-siguiente-fix-hora-lineup-y-
// bulk-logging.md — quedaron aprobados sin ninguna fila en festival_lineup
// porque el insert fallaba en silencio por el bug de hora inválida (ya
// corregido). El link candidato→festival es el que approveCandidate ya
// escribió en su momento (event_candidates.festival_id) — no hace falta
// adivinar por nombre/fecha, es el mismo mecanismo cierto que usa el resto
// del admin.
const BROKEN_FESTIVAL_IDS = [
  '5dc9c14b-d5ac-4232-a6e2-f7e7f4bc1ecc', // YURIDIA - LAS CARTAS SOBRE LA MESA TOUR (19 sep)
  'b3cc106d-38b3-4bd8-8888-2c60ed4ccc4a', // CIRQUE DU SOLEIL - ECHO - GNP EXPERIENCE
  '3a714215-dea3-4baa-b747-00ea0a381f4e', // SIDDHARTHA
  '9402bc1c-3bab-4255-8b0e-d10a16d051f6', // Sotomayor
  '62eeb62c-c6fa-458e-a5d1-aac1f1958663', // CAMPIRINO
  '4b7a4c6d-7682-4e21-b462-aa90538e2445', // YURIDIA - LAS CARTAS SOBRE LA MESA TOUR (18 sep)
  '85132291-7a06-4324-83a9-88efcec92630', // Piano Bar El Concierto
  '194a7848-9fb3-4210-8a4e-2c30522a398e', // Dr. Pink! Amigxs Tour
  'b0f960f7-b9b7-41ce-be87-dfaacd0d5f3c', // OMAKASE - Álvaro Díaz (19 sep)
  '377d204a-0abb-40fa-bd73-905bf9b2d088', // Destino Dos Equis
  '34d3827d-97fd-4f08-8451-d5686ea43c07', // OMAKASE - Álvaro Díaz (22 sep)
  '8b611a7e-7358-4879-83ae-e69b2d1be0d1', // The Neighbourhood - The Wourld Tour ***SUITES***
  'a8ea7649-6166-4a21-b19f-eebec70ab3a0', // OMAKASE - Álvaro Díaz (24 sep)
];

export type RepairPreviewItem = {
  festivalId: string;
  festivalNombre: string;
  fechaInicio: string;
  candidateId: string | null;
  currentLineupCount: number;
  lineup: { artista: string; escenario: string | null; horarioRaw: string | null; horarioNormalizado: string | null }[];
  note: string | null; // por qué no se puede reparar, si aplica
};

function lineupArtista(item: unknown): { artista: string; escenario: string | null; horario: string | null } | null {
  if (typeof item === 'string') return { artista: item, escenario: null, horario: null };
  if (item && typeof item === 'object' && 'artista' in item) {
    const obj = item as { artista: unknown; escenario?: unknown; horario?: unknown };
    if (typeof obj.artista === 'string') {
      return {
        artista: obj.artista,
        escenario: typeof obj.escenario === 'string' ? obj.escenario : null,
        horario: typeof obj.horario === 'string' ? obj.horario : null,
      };
    }
  }
  return null;
}

export async function getRepairPreview(): Promise<{ error?: string; items?: RepairPreviewItem[] }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };

  const supabase = await createClient();

  const [{ data: festivals, error: festivalsError }, { data: candidates, error: candidatesError }, { data: existingLineup }] =
    await Promise.all([
      supabase.from('festivals').select('id, nombre, fecha_inicio').in('id', BROKEN_FESTIVAL_IDS),
      supabase
        .from('event_candidates')
        .select('id, festival_id, lineup, tipo, nombre')
        .in('festival_id', BROKEN_FESTIVAL_IDS),
      supabase.from('festival_lineup').select('festival_id').in('festival_id', BROKEN_FESTIVAL_IDS),
    ]);

  if (festivalsError) return { error: festivalsError.message };
  if (candidatesError) return { error: candidatesError.message };

  const festivalById = new Map((festivals ?? []).map((f) => [f.id, f]));
  const candidatesByFestivalId = new Map((candidates ?? []).map((c) => [c.festival_id as string, c]));
  const existingLineupCount = new Map<string, number>();
  for (const row of existingLineup ?? []) {
    existingLineupCount.set(row.festival_id, (existingLineupCount.get(row.festival_id) ?? 0) + 1);
  }

  const items: RepairPreviewItem[] = BROKEN_FESTIVAL_IDS.map((festivalId) => {
    const festival = festivalById.get(festivalId);
    const currentLineupCount = existingLineupCount.get(festivalId) ?? 0;

    if (!festival) {
      return {
        festivalId,
        festivalNombre: '(festival no encontrado)',
        fechaInicio: '',
        candidateId: null,
        currentLineupCount,
        lineup: [],
        note: 'No se encontró este festival por ID — repórtalo, no se puede reparar a ciegas.',
      };
    }

    const candidate = candidatesByFestivalId.get(festivalId);
    if (!candidate) {
      return {
        festivalId,
        festivalNombre: festival.nombre,
        fechaInicio: festival.fecha_inicio,
        candidateId: null,
        currentLineupCount,
        lineup: [],
        note: 'No se encontró el event_candidate que originó este festival (festival_id) — no se puede reparar sin adivinar de dónde sacar el line-up.',
      };
    }

    const rawLineup = Array.isArray(candidate.lineup) ? candidate.lineup : [];
    const lineup = rawLineup
      .map(lineupArtista)
      .filter((l): l is { artista: string; escenario: string | null; horario: string | null } => l !== null)
      .map((l) => ({
        artista: l.artista,
        escenario: l.escenario,
        horarioRaw: l.horario,
        horarioNormalizado: normalizeHorario(festival.fecha_inicio, l.horario),
      }));

    return {
      festivalId,
      festivalNombre: festival.nombre,
      fechaInicio: festival.fecha_inicio,
      candidateId: candidate.id,
      currentLineupCount,
      lineup,
      note:
        currentLineupCount > 0
          ? `Ya tiene ${currentLineupCount} fila(s) en festival_lineup — se salta para no duplicar.`
          : lineup.length === 0
            ? 'El candidato no tiene line-up guardado (nada que reparar).'
            : null,
    };
  });

  return { items };
}

export type RepairResult = { festivalId: string; festivalNombre: string; inserted?: number; error?: string };

export async function applyLineupRepair(festivalIds: string[]): Promise<{ results: RepairResult[] }> {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return { results: festivalIds.map((id) => ({ festivalId: id, festivalNombre: id, error: 'No autorizado.' })) };
  }

  const { items, error } = await getRepairPreview();
  if (error || !items) {
    return { results: festivalIds.map((id) => ({ festivalId: id, festivalNombre: id, error: error ?? 'No se pudo leer el preview.' })) };
  }

  const supabase = await createClient();
  const results: RepairResult[] = [];

  for (const festivalId of festivalIds) {
    const item = items.find((i) => i.festivalId === festivalId);
    if (!item) {
      results.push({ festivalId, festivalNombre: festivalId, error: 'No estaba en el preview.' });
      continue;
    }
    // Defensivo: si ya tiene line-up (ej. se corrió esto dos veces, o alguien
    // ya lo reparó a mano desde /festivals/[id]), no se duplica.
    if (item.currentLineupCount > 0 || item.lineup.length === 0 || !item.candidateId) {
      results.push({ festivalId, festivalNombre: item.festivalNombre, inserted: 0 });
      continue;
    }

    const artistIds = await resolveArtistIds(supabase, item.lineup.map((l) => l.artista));
    const { error: insertError, count } = await supabase
      .from('festival_lineup')
      .insert(
        item.lineup.map((l) => ({
          festival_id: festivalId,
          artista: l.artista,
          escenario: l.escenario,
          horario: l.horarioNormalizado,
          artist_id: artistIds.get(l.artista) ?? null,
        })),
        { count: 'exact' },
      );

    if (insertError) {
      console.error(`Reparación de line-up falló para festival ${festivalId} (${item.festivalNombre}):`, insertError);
      results.push({ festivalId, festivalNombre: item.festivalNombre, error: insertError.message });
      continue;
    }

    results.push({ festivalId, festivalNombre: item.festivalNombre, inserted: count ?? item.lineup.length });
  }

  revalidatePath('/candidatos/reparar-lineup');
  revalidatePath('/admin');

  return { results };
}
