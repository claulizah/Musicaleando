import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findPossibleDuplicate, type SuperboletosEvent } from '@/lib/superboletosSync/extract';
import type { Database } from '@/lib/database.types';

// ⛔ APAGADO A PROPÓSITO — mismo patrón que eticket-sync (event_candidates,
// 'pendiente', nunca publicación directa), pero Claudia todavía no vio el
// resultado ni decidió activarlo. Esta ruta responde "disabled" sin lanzar
// ningún navegador mientras SUPERBOLETOS_SYNC_ENABLED no sea "true" (no
// está configurada en ningún entorno hoy), y tampoco hay ninguna entrada de
// cron en vercel.json que la llame.
//
// Nunca llama al endpoint interno de AWS (API Gateway + Cognito) ni usa
// ninguna credencial encontrada en el código del sitio — ver
// src/lib/superboletosSync/runner.ts, que es el único lugar que toca la red
// del lado de Superboletos, y solo hace un `page.goto()` normal.
export async function POST(req: NextRequest) {
  if (process.env.SUPERBOLETOS_SYNC_ENABLED !== 'true') {
    return NextResponse.json({ disabled: true, message: 'Superboletos sync está apagado a propósito.' });
  }

  const secret = process.env.SUPERBOLETOS_SYNC_SECRET;
  if (!secret || req.headers.get('x-sync-secret') !== secret) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 });
  }
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  try {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: playwright } = await import('playwright-core');
    const { runSuperboletosSync } = await import('@/lib/superboletosSync/runner');

    const browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    let syncResult;
    try {
      syncResult = await runSuperboletosSync(browser);
    } finally {
      await browser.close();
    }
    if (syncResult.error) {
      return NextResponse.json({ error: syncResult.error }, { status: 502 });
    }

    const { data: festivals, error: festivalsError } = await supabase
      .from('festivals')
      .select('id, nombre, ciudad, fecha_inicio');
    if (festivalsError) throw festivalsError;

    const { data: existingRows, error: existingError } = await supabase
      .from('event_candidates')
      .select('source_id, estado')
      .eq('source', 'superboletos')
      .limit(10000);
    if (existingError) throw existingError;
    const existingBySourceId = new Map((existingRows ?? []).map((r) => [r.source_id, r.estado]));

    let created = 0;
    let updated = 0;
    let possibleDuplicates = 0;
    const seenSourceIds: string[] = [];
    const rowsToUpsert: Database['public']['Tables']['event_candidates']['Insert'][] = [];

    for (const ev of syncResult.eventos as SuperboletosEvent[]) {
      seenSourceIds.push(ev.eventoId);
      const existingEstado = existingBySourceId.get(ev.eventoId);
      const possibleDup = findPossibleDuplicate({ nombre: ev.nombre, ciudad: ev.ciudad, fecha_iso: ev.fecha_iso }, festivals ?? []);
      if (possibleDup) possibleDuplicates++;
      if (existingEstado === undefined) created++;
      else updated++;

      rowsToUpsert.push({
        source: 'superboletos',
        source_id: ev.eventoId,
        nombre: ev.nombre,
        ciudad: ev.ciudad,
        venue: ev.venue,
        fecha_inicio: ev.fecha_iso,
        fecha_fin: ev.fecha_iso,
        lineup: [],
        price_min: ev.price_min,
        price_max: ev.price_max,
        price_currency: ev.price_min || ev.price_max ? 'MXN' : null,
        link_boletos: ev.link,
        raw_payload: ev as unknown as Record<string, unknown>,
        completo: Boolean(ev.nombre && ev.ciudad && ev.fecha_iso && ev.link),
        estado: existingEstado ?? 'pendiente',
        possible_duplicate_of: possibleDup,
        possible_duplicate_candidate_of: null,
        festival_id: null,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await supabase.from('event_candidates').upsert(rowsToUpsert, { onConflict: 'source,source_id' });
      if (upsertError) throw upsertError;
    }

    // Un candidato 'pendiente' que lleva varios días sin aparecer en la
    // respuesta del sitio -> 'desaparecido' (mismo patrón que
    // ticketmaster-sync/eticket-sync). Nunca se borra, nunca se toca algo
    // que Claudia ya haya decidido.
    const STALE_AFTER_DAYS = 5;
    const staleThreshold = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleRows, error: staleError } = await supabase
      .from('event_candidates')
      .update({ estado: 'desaparecido' })
      .eq('source', 'superboletos')
      .eq('estado', 'pendiente')
      .lt('last_seen_at', staleThreshold)
      .not('source_id', 'in', `(${seenSourceIds.map((id) => `"${id}"`).join(',') || '""'})`)
      .select('id');
    if (staleError) throw staleError;

    return NextResponse.json({
      total_en_respuesta: syncResult.totalEnRespuesta,
      eventos_musicales_vigentes: syncResult.eventos.length,
      created,
      updated,
      possible_duplicates: possibleDuplicates,
      marked_desaparecido: staleRows?.length ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
