'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import {
  buildPreview,
  validateRow,
  type CsvEventRow,
  type ExistingFestival,
  type PreviewRow,
} from '@/lib/csvEventImport';

const MAX_CSV_CHARS = 2_000_000;
const MAX_IMPORT_ROWS = 2000;

// Solo analiza y detecta duplicados — no escribe nada.
export async function previewCsvImport(
  csvText: string,
): Promise<{ error?: string; rows?: PreviewRow[]; usedHeaderless?: boolean }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { error: 'No autorizado.' };
  if (csvText.length > MAX_CSV_CHARS) return { error: 'El archivo es demasiado grande (máx. ~2 MB).' };

  const supabase = await createClient();

  // festivals ya supera los 700 registros — se pagina explícito para no
  // quedarse en el tope de 1000 filas por página de PostgREST cuando crezca.
  const existing: ExistingFestival[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('festivals')
      .select('id, nombre, ciudad, fecha_inicio, estado_evento')
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { error: error.message };
    existing.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const result = buildPreview(csvText, existing);
  if (!result.ok) return { error: result.error };
  return { rows: result.rows, usedHeaderless: result.usedHeaderless };
}

function todayInMexico(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

export type ImportResult = { created: number; archivedOnCreate: number; errors: { nombre: string; error: string }[] };

// Nunca confía en lo que mande el cliente: cada fila se vuelve a validar aquí.
// Un lote que falla se reintenta fila por fila para aislar la fila mala en vez
// de perder todo el lote — un error no tumba el resto de la importación.
export async function confirmCsvImport(rows: CsvEventRow[]): Promise<ImportResult> {
  const admin = await requireAdmin();
  const empty: ImportResult = { created: 0, archivedOnCreate: 0, errors: [] };
  if (!admin.authorized) return { ...empty, errors: [{ nombre: '(todas)', error: 'No autorizado.' }] };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { ...empty, errors: [{ nombre: '(todas)', error: `Máximo ${MAX_IMPORT_ROWS} filas por importación.` }] };
  }

  const today = todayInMexico();
  const valid: (CsvEventRow & { estado_evento: 'activo' | 'archivado' })[] = [];
  const errors: ImportResult['errors'] = [];

  for (const r of rows) {
    const v = validateRow({
      nombre: r.nombre,
      tipo: r.tipo,
      ciudad: r.ciudad,
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      link_boletos: r.link_boletos ?? '',
    });
    if ('errors' in v) {
      errors.push({ nombre: r.nombre || '(sin nombre)', error: v.errors.join(' ') });
      continue;
    }
    // Un evento que ya terminó (ej. un CSV con historial) entra directo como
    // archivado en vez de aparecer en la app hasta el siguiente ciclo diario.
    valid.push({ ...v.row, estado_evento: v.row.fecha_fin < today ? 'archivado' : 'activo' });
  }

  const supabase = await createClient();
  let created = 0;
  let archivedOnCreate = 0;
  const CHUNK = 100;

  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    const { error } = await supabase.from('festivals').insert(chunk);
    if (!error) {
      created += chunk.length;
      archivedOnCreate += chunk.filter((c) => c.estado_evento === 'archivado').length;
      continue;
    }
    for (const item of chunk) {
      const { error: rowError } = await supabase.from('festivals').insert(item);
      if (rowError) {
        errors.push({ nombre: item.nombre, error: rowError.message });
      } else {
        created++;
        if (item.estado_evento === 'archivado') archivedOnCreate++;
      }
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/calendario');
  return { created, archivedOnCreate, errors };
}
