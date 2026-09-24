import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CATEGORIA_MUSICA, findPossibleDuplicate, normalizeEvent, parseEventList } from "./normalize.ts";

// Sync de conciertos de Arema (arema.mx) hacia `event_candidates` — SIEMPRE
// como 'pendiente', nunca escribe en `festivals`. Mismo patrón que
// eticket-sync (auth por secreto propio, upsert por lote, nunca pisar una
// decisión humana ya tomada, 'desaparecido' tras varios días sin verse).
//
// FUENTE: POST https://t3lb.arema.mx/public/events/list — la API pública que
// consulta la propia página de arema.mx (sin credenciales ni token; solo un
// header `show-code: 0` que es una bandera, no un secreto). Se eligió sobre
// el JSON embebido en el HTML de w.arema.mx porque esta API trae la hora
// REAL del evento (`date`, Unix), mientras que el HTML trae una hora de
// relleno (18:00 UTC) en la mayoría de los conciertos. Una sola petición
// devuelve las 696 entradas (~185 KB); no hace falta paginar ni un navegador.
// robots.txt de arema.mx permite todo. Es una decisión de riesgo de Claudia,
// no una autorización legal explícita (igual que eTicket).
//
// APAGADO POR DEFECTO: sin el secreto AREMA_SYNC_ENABLED=true la función
// responde {disabled:true} sin tocar nada, y NO hay cron programado. Para
// una prueba puntual: encender el secreto, invocar una vez y apagarlo.
// `{"dry_run": true}` en el cuerpo calcula todo pero no escribe.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("AREMA_SYNC_SECRET");
const ENABLED = Deno.env.get("AREMA_SYNC_ENABLED") === "true";

const API_URL = "https://t3lb.arema.mx/public/events/list";
const USER_AGENT = "Mozilla/5.0 (compatible; MusicaleandoBot/1.0; +https://musicaleando.com/eliminar-cuenta; clauliz.acosta@gmail.com)";
const STALE_AFTER_DAYS = 5;
const UPSERT_CHUNK = 200;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SYNC_SECRET || req.headers.get("x-sync-secret") !== SYNC_SECRET) return json({ error: "No autorizado." }, 401);
  if (!ENABLED) return json({ disabled: true, message: "arema-sync está apagado (AREMA_SYNC_ENABLED != true)." });

  let dryRun = false;
  try {
    dryRun = Boolean((await req.json())?.dry_run);
  } catch {
    // sin cuerpo: corrida normal
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "show-code": "0", "User-Agent": USER_AGENT },
      body: "{}",
    });
    if (!res.ok) throw new Error(`Arema events/list respondió HTTP ${res.status}`);
    const all = parseEventList(await res.json());
    const musica = all.filter((e) => e.category_name === CATEGORIA_MUSICA);
    if (musica.length === 0) throw new Error(`Arema: 0 eventos con categoría "${CATEGORIA_MUSICA}" de ${all.length} — ¿cambió el nombre de la categoría?`);

    const { data: festivals, error: fErr } = await supabase.from("festivals").select("id, nombre, ciudad, fecha_inicio");
    if (fErr) throw fErr;
    const { data: existingRows, error: eErr } = await supabase
      .from("event_candidates")
      .select("source_id, estado")
      .eq("source", "arema")
      .limit(10000);
    if (eErr) throw eErr;
    const existingBySourceId = new Map((existingRows ?? []).map((r) => [r.source_id, r.estado]));
    // Candidatos pendientes de OTRAS fuentes: un evento que ya está en la
    // bandeja (Ticketmaster/eTicket/…) se marca como posible duplicado de ese
    // candidato, no solo de un festival ya aprobado.
    const { data: otherCandidates, error: cErr } = await supabase
      .from("event_candidates")
      .select("id, nombre, ciudad, fecha_inicio")
      .eq("estado", "pendiente")
      .neq("source", "arema")
      .limit(10000);
    if (cErr) throw cErr;

    const seen: string[] = [];
    const rows: Record<string, unknown>[] = [];
    let created = 0, updated = 0, incomplete = 0, dupFestival = 0, dupCandidate = 0;

    for (const ev of musica) {
      const n = normalizeEvent(ev);
      seen.push(n.source_id);
      if (!n.completo) incomplete++;
      const existingEstado = existingBySourceId.get(n.source_id);

      const asEvent = { nombre: n.nombre, ciudad: n.ciudad, fecha_inicio: n.fecha_inicio };
      const festDup = findPossibleDuplicate(asEvent, festivals ?? []);
      // Una sola de las dos columnas a la vez (constraint de la tabla):
      // festival aprobado tiene prioridad sobre otro candidato.
      const candDup = festDup ? null : findPossibleDuplicate(asEvent, otherCandidates ?? []);
      if (festDup) dupFestival++;
      if (candDup) dupCandidate++;

      if (existingEstado === undefined) created++;
      else updated++;

      rows.push({
        source: n.source,
        source_id: n.source_id,
        nombre: n.nombre,
        ciudad: n.ciudad,
        venue: n.venue,
        fecha_inicio: n.fecha_inicio,
        fecha_fin: n.fecha_fin,
        lineup: n.lineup,
        price_min: n.price_min,
        price_max: n.price_max,
        price_currency: n.price_currency,
        link_boletos: n.link_boletos,
        image_url: n.image_url,
        raw_payload: n.raw_payload,
        completo: n.completo,
        estado: existingEstado ?? "pendiente", // nunca pisar una decisión humana
        possible_duplicate_of: festDup,
        possible_duplicate_candidate_of: candDup,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
    }

    let markedDesaparecido = 0;
    if (!dryRun) {
      for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
        const { error } = await supabase
          .from("event_candidates")
          .upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: "source,source_id" });
        if (error) throw error;
      }
      const staleThreshold = new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000).toISOString();
      const { data: staleRows, error: sErr } = await supabase
        .from("event_candidates")
        .update({ estado: "desaparecido" })
        .eq("source", "arema")
        .eq("estado", "pendiente")
        .lt("last_seen_at", staleThreshold)
        .not("source_id", "in", `(${seen.map((id) => `"${id}"`).join(",")})`)
        .select("id");
      if (sErr) throw sErr;
      markedDesaparecido = staleRows?.length ?? 0;
    }

    return json({
      dry_run: dryRun,
      events_in_api: all.length,
      conciertos: musica.length,
      created,
      updated,
      incomplete,
      possible_duplicate_of_festival: dupFestival,
      possible_duplicate_of_candidate: dupCandidate,
      marked_desaparecido: markedDesaparecido,
    });
  } catch (err) {
    // Falla en voz alta (HTTP 500 + log), nunca datos vacíos en silencio.
    console.error("arema-sync falló:", err);
    return json({ error: String(err instanceof Error ? err.message : err) }, 500);
  }
});
