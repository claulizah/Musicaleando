import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractLdEvents, findPossibleDuplicate, normalizeEvent } from "./normalize.ts";

// Sync diario de eventos de música de eticket.mx hacia `event_candidates` —
// SIEMPRE como 'pendiente', nunca escribe en `festivals` (solo el panel
// admin, con aprobación manual, materializa un candidato). Mismo patrón que
// ticketmaster-sync (ver ese archivo para el porqué de cada decisión
// compartida: auth por secreto propio, upsert por lote, nunca pisar una
// decisión humana ya tomada). La lógica de parseo/normalización vive en
// ./normalize.ts (sin imports de Deno) para poder probarla con Node — ver
// tests/unit/eticketSync.test.mts.
//
// A DIFERENCIA de Ticketmaster (API oficial con contrato de datos), esto lee
// el JSON-LD (schema.org/Event) que eticket.mx publica en sus páginas de
// listado para buscadores — es HTML público, no una API. Antes de construir
// esto se revisaron sus Términos y condiciones (compraventa de boletos, sin
// cláusula sobre reproducción/extracción automatizada — ni prohíben ni
// autorizan explícitamente) y se probó el acceso con varios user-agents,
// incluido uno que se identifica como bot (ver USER_AGENT): las páginas de
// listado (`eventos.aspx?categoria=N`) respondieron 200 consistentemente en
// todas las pruebas. Es una decisión de riesgo de Claudia, no una
// autorización legal explícita — ya se envió una solicitud de permiso a
// eticket.mx; si responden negativo, esta función debe apagarse (desactivar
// el cron `eticket-sync-daily`, ver migración 20260922000000).
//
// Categorías cubiertas: 1 (Conciertos) y 7 (Festivales) — las únicas
// relevantes de música; el sitio también vende Teatro, Deportes, Culturales,
// Familiares, Congresos y Comedia, fuera del alcance del catálogo.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("ETICKET_SYNC_SECRET");

const CATEGORIAS = [1, 7] as const; // Conciertos, Festivales
const REQUEST_SPACING_MS = 2000; // cortesía con el sitio de origen — no es una API pensada para esto
// Nos identificamos como lo que somos, con un contacto real, en vez de
// simular ser un navegador — mismo espíritu que un crawler educado
// (Facebook/Google lo hacen). No cambió el resultado en las pruebas (200 con
// cualquier user-agent), así que no hay motivo para ocultar el origen.
const USER_AGENT = "Mozilla/5.0 (compatible; MusicaleandoBot/1.0; +https://musicaleando.com/eliminar-cuenta; clauliz.acosta@gmail.com)";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!SYNC_SECRET || req.headers.get("x-sync-secret") !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: "No autorizado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: festivals, error: festivalsError } = await supabase
      .from("festivals")
      .select("id, nombre, ciudad, fecha_inicio");
    if (festivalsError) throw festivalsError;

    const { data: existingRows, error: existingError } = await supabase
      .from("event_candidates")
      .select("source_id, estado")
      .eq("source", "eticket")
      .limit(10000);
    if (existingError) throw existingError;
    const existingBySourceId = new Map((existingRows ?? []).map((r) => [r.source_id, r.estado]));

    const seenSourceIds: string[] = [];
    let created = 0;
    let updated = 0;
    let incomplete = 0;
    let possibleDuplicates = 0;
    let excludedNuevoCancelado = 0;
    let markedCancelado = 0;
    let skippedPrueba = 0;
    const rowsToUpsert: Record<string, unknown>[] = [];

    for (let i = 0; i < CATEGORIAS.length; i++) {
      if (i > 0) await sleep(REQUEST_SPACING_MS);
      const categoria = CATEGORIAS[i];
      const res = await fetch(`https://www.eticket.mx/eventos.aspx?categoria=${categoria}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!res.ok) throw new Error(`eticket.mx respondió ${res.status} en categoria=${categoria}`);
      // eticket.mx sirve la página como ISO-8859-15 (Content-Type:
      // text/html; charset=iso-8859-15) — confirmado contra la respuesta
      // real. res.text() decodifica siempre como UTF-8 por spec (WHATWG
      // Fetch), sin importar el charset del header, así que "Á"/"Í"/etc. se
      // corrompían en silencio (no daban error, solo nombres/ciudades mal
      // escritos que además rompían la comparación de duplicados contra el
      // catálogo, que sí está en UTF-8). Se decodifica explícitamente con el
      // charset real de la fuente.
      const buffer = await res.arrayBuffer();
      const html = new TextDecoder("iso-8859-15").decode(buffer);
      const ldEvents = extractLdEvents(html);

      for (const ev of ldEvents) {
        const normalized = normalizeEvent(ev);
        if (!normalized.source_id) continue; // sin idevento no hay forma confiable de identificarlo entre corridas
        if (normalized.esEventoDePrueba) {
          skippedPrueba++;
          continue;
        }
        seenSourceIds.push(normalized.source_id);
        if (!normalized.completo) incomplete++;

        const existingEstado = existingBySourceId.get(normalized.source_id);

        // Un evento cancelado/pospuesto que NUNCA se vio antes no se crea
        // como candidato — no hay nada que revisar. Uno que ya estaba
        // pendiente y ahora se reporta cancelado sí se marca (misma regla
        // que ticketmaster-sync): es información de seguridad que Claudia
        // debe ver, para no aprobarlo por error.
        if (normalized.cancelado_o_pospuesto && existingEstado === undefined) {
          excludedNuevoCancelado++;
          continue;
        }

        const possibleDup = normalized.ciudad || normalized.fecha_inicio
          ? findPossibleDuplicate(
            { nombre: normalized.nombre, ciudad: normalized.ciudad, fecha_inicio: normalized.fecha_inicio },
            festivals ?? [],
          )
          : null;
        if (possibleDup) possibleDuplicates++;

        let estado: string;
        if (existingEstado === undefined) {
          estado = "pendiente";
        } else if (normalized.cancelado_o_pospuesto && existingEstado !== "descartado") {
          estado = "cancelado";
        } else {
          estado = existingEstado;
        }
        if (normalized.cancelado_o_pospuesto && existingEstado !== "descartado" && existingEstado !== undefined) markedCancelado++;
        if (existingEstado === undefined) created++;
        else updated++;

        rowsToUpsert.push({
          source: normalized.source,
          source_id: normalized.source_id,
          nombre: normalized.nombre,
          ciudad: normalized.ciudad,
          venue: normalized.venue,
          fecha_inicio: normalized.fecha_inicio,
          fecha_fin: normalized.fecha_fin,
          lineup: normalized.lineup,
          price_min: normalized.price_min,
          price_max: normalized.price_max,
          price_currency: normalized.price_currency,
          link_boletos: normalized.link_boletos,
          image_url: normalized.image_url,
          raw_payload: normalized.raw_payload,
          completo: normalized.completo,
          estado,
          possible_duplicate_of: possibleDup,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        });
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("event_candidates")
        .upsert(rowsToUpsert, { onConflict: "source,source_id" });
      if (upsertError) throw upsertError;
    }

    // Igual que ticketmaster-sync: un candidato 'pendiente' que lleva varios
    // días sin aparecer en el listado de origen se marca 'desaparecido' —
    // nunca se borra, nunca se toca algo ya decidido por un humano.
    const STALE_AFTER_DAYS = 5;
    const staleThreshold = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleRows, error: staleError } = await supabase
      .from("event_candidates")
      .update({ estado: "desaparecido" })
      .eq("source", "eticket")
      .eq("estado", "pendiente")
      .lt("last_seen_at", staleThreshold)
      .not("source_id", "in", `(${seenSourceIds.map((id) => `"${id}"`).join(",") || '""'})`)
      .select("id");
    if (staleError) throw staleError;

    return new Response(
      JSON.stringify({
        categorias: CATEGORIAS,
        events_seen: seenSourceIds.length,
        created,
        updated,
        incomplete,
        possible_duplicates: possibleDuplicates,
        excluded_nuevo_cancelado_o_pospuesto: excludedNuevoCancelado,
        marked_cancelado: markedCancelado,
        skipped_evento_de_prueba: skippedPrueba,
        marked_desaparecido: staleRows?.length ?? 0,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
