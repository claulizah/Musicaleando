import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Sync batch de eventos de música en México desde la Ticketmaster Discovery
// API v2, hacia `event_candidates` — SIEMPRE como 'pendiente'. Nunca escribe
// en `festivals`; solo el panel admin (aprobación manual) hace esa
// materialización. Pensado para correr por cron (ver migración
// event_candidates.sql), no por request de usuario/admin.
//
// Auth: esta función se despliega con --no-verify-jwt (el cron de Postgres
// no manda un JWT de Supabase) y en su lugar valida un secreto compartido
// propio (x-sync-secret) contra TICKETMASTER_SYNC_SECRET — nunca la service
// role key real, para reducir el blast radius si el secreto se filtra.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_SECRET = Deno.env.get("TICKETMASTER_SYNC_SECRET");
const TM_CONSUMER_KEY = Deno.env.get("TICKETMASTER_CONSUMER_KEY");

// La Discovery API v2 (GET) solo requiere el Consumer Key como `apikey` en
// la query string — el Consumer Secret es para flujos OAuth de otras APIs
// de Ticketmaster (Partner APIs), no para Discovery. Se guarda igual como
// secreto por si se necesita más adelante, pero no se usa en este sync.
const TM_BASE_URL = "https://app.ticketmaster.com/discovery/v2/events.json";

const PAGE_SIZE = 200;
const MAX_PAGES = 25; // tope defensivo: 25*200 = 5000, el límite diario completo
const REQUEST_SPACING_MS = 250; // ~4 req/s, bajo el límite de 5 req/s
const MAX_RETRIES_PER_PAGE = 3;
const STALE_AFTER_DAYS = 3; // ~2 corridas (2x/día) sin ver el evento -> "desaparecido"

type TmClassification = { segment?: { name?: string } };
type TmAttraction = { name?: string };
type TmVenue = { name?: string; city?: { name?: string }; state?: { name?: string } };
type TmPriceRange = { min?: number; max?: number; currency?: string };
type TmEvent = {
  id: string;
  name: string;
  url?: string;
  dates?: {
    start?: { localDate?: string };
    end?: { localDate?: string };
    status?: { code?: string };
  };
  classifications?: TmClassification[];
  priceRanges?: TmPriceRange[];
  _embedded?: { venues?: TmVenue[]; attractions?: TmAttraction[] };
};

type TmResponse = {
  _embedded?: { events?: TmEvent[] };
  page?: { number: number; totalPages: number; totalElements: number };
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(page: number): Promise<TmResponse> {
  const url = new URL(TM_BASE_URL);
  url.searchParams.set("apikey", TM_CONSUMER_KEY!);
  url.searchParams.set("countryCode", "MX");
  url.searchParams.set("classificationName", "Music");
  url.searchParams.set("size", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));

  for (let attempt = 0; attempt < MAX_RETRIES_PER_PAGE; attempt++) {
    const res = await fetch(url.toString());
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2000 * 2 ** attempt;
      console.warn(`429 en page ${page}, intento ${attempt + 1}/${MAX_RETRIES_PER_PAGE}, esperando ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Ticketmaster respondió ${res.status} en page ${page}: ${await res.text()}`);
    }
    return (await res.json()) as TmResponse;
  }
  throw new Error(`Página ${page} agotó reintentos por 429 (cuota probablemente agotada).`);
}

// Comparación aproximada nombre+fecha+venue contra festivales ya cargados a
// mano — solo para REPORTAR un posible duplicado, nunca para fusionar o
// bloquear el insert del candidato.
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findPossibleDuplicate(
  event: { nombre: string; ciudad: string | null; fecha_inicio: string | null },
  festivals: { id: string; nombre: string; ciudad: string; fecha_inicio: string }[],
): string | null {
  const normName = normalize(event.nombre);
  for (const f of festivals) {
    const normFestName = normalize(f.nombre);
    const namesMatch = normName === normFestName || normName.includes(normFestName) || normFestName.includes(normName);
    if (!namesMatch) continue;

    if (event.fecha_inicio) {
      const diffMs = Math.abs(new Date(event.fecha_inicio).getTime() - new Date(f.fecha_inicio).getTime());
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 1) continue;
    }

    if (event.ciudad && f.ciudad) {
      const ciudadesMatch = normalize(event.ciudad).includes(normalize(f.ciudad)) ||
        normalize(f.ciudad).includes(normalize(event.ciudad));
      if (!ciudadesMatch) continue;
    }

    return f.id;
  }
  return null;
}

function normalizeEvent(ev: TmEvent) {
  const venue = ev._embedded?.venues?.[0];
  const lineup = (ev._embedded?.attractions ?? [])
    .map((a) => a.name)
    .filter((n): n is string => Boolean(n));
  const price = ev.priceRanges?.[0];
  const statusCode = ev.dates?.status?.code;

  const nombre = ev.name;
  // Ticketmaster reporta "México" (el país, no una ciudad) como city.name
  // para muchas sedes de Ciudad de México — confirmado con datos reales:
  // en esos casos state.name trae el valor específico correcto ("Ciudad de
  // México"), city.name simplemente no lo tiene. Se usa como respaldo solo
  // en ese caso puntual, no como reemplazo general de city.name.
  const rawCity = venue?.city?.name ?? null;
  const ciudad = rawCity === "México" ? (venue?.state?.name ?? rawCity) : rawCity;
  const fecha_inicio = ev.dates?.start?.localDate ?? null;
  const fecha_fin = ev.dates?.end?.localDate ?? null;
  const link_boletos = ev.url ?? null;

  return {
    source: "ticketmaster" as const,
    source_id: ev.id,
    nombre,
    ciudad,
    venue: venue?.name ?? null,
    fecha_inicio,
    fecha_fin,
    lineup,
    price_min: price?.min ?? null,
    price_max: price?.max ?? null,
    price_currency: price?.currency ?? null,
    link_boletos,
    raw_payload: ev as unknown as Record<string, unknown>,
    completo: Boolean(nombre && ciudad && fecha_inicio && link_boletos),
    tm_cancelled: statusCode === "cancelled",
  };
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

  if (!TM_CONSUMER_KEY) {
    return new Response(JSON.stringify({ error: "Falta el secreto TICKETMASTER_CONSUMER_KEY." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: festivals, error: festivalsError } = await supabase
      .from("festivals")
      .select("id, nombre, ciudad, fecha_inicio");
    if (festivalsError) throw festivalsError;

    // Un select + un upsert POR EVENTO (~737 eventos MX/Music en la primera
    // corrida real) es demasiado lento como llamadas secuenciales — agotaba
    // el timeout de la function. Se trae el estado existente UNA vez al
    // inicio (no por evento) y se upsertea por lote (una llamada por página
    // de la API, no por fila).
    const { data: existingRows, error: existingError } = await supabase
      .from("event_candidates")
      .select("source_id, estado")
      .eq("source", "ticketmaster")
      .limit(10000);
    if (existingError) throw existingError;
    const existingBySourceId = new Map((existingRows ?? []).map((r) => [r.source_id, r.estado]));

    const seenSourceIds: string[] = [];
    let created = 0;
    let updated = 0;
    let incomplete = 0;
    let possibleDuplicates = 0;
    let cancelled = 0;
    let page = 0;
    let totalPages = 1;

    while (page < totalPages && page < MAX_PAGES) {
      if (page > 0) await sleep(REQUEST_SPACING_MS);
      const data = await fetchPage(page);
      totalPages = data.page?.totalPages ?? 1;

      const events = data._embedded?.events ?? [];
      const pageRows = events.map((ev) => {
        const normalized = normalizeEvent(ev);
        seenSourceIds.push(normalized.source_id);
        if (!normalized.completo) incomplete++;

        const existingEstado = existingBySourceId.get(normalized.source_id);
        const possibleDup = normalized.ciudad || normalized.fecha_inicio
          ? findPossibleDuplicate(
            { nombre: normalized.nombre, ciudad: normalized.ciudad, fecha_inicio: normalized.fecha_inicio },
            festivals ?? [],
          )
          : null;
        if (possibleDup) possibleDuplicates++;

        // Nunca se pisa una decisión humana ya tomada (aprobado/descartado)
        // con 'pendiente' otra vez en un resync — solo se refresca metadata
        // y last_seen_at. La única transición automática permitida encima de
        // una decisión humana es marcar 'cancelado' si la fuente lo reporta,
        // porque es información de seguridad real que el admin debe ver.
        let estado: string;
        if (existingEstado === undefined) {
          estado = normalized.tm_cancelled ? "cancelado" : "pendiente";
        } else if (normalized.tm_cancelled && existingEstado !== "descartado") {
          estado = "cancelado";
        } else {
          estado = existingEstado;
        }
        if (normalized.tm_cancelled && existingEstado !== "descartado") cancelled++;
        if (existingEstado === undefined) created++;
        else updated++;

        return {
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
          raw_payload: normalized.raw_payload,
          completo: normalized.completo,
          estado,
          possible_duplicate_of: possibleDup,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        };
      });

      if (pageRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("event_candidates")
          .upsert(pageRows, { onConflict: "source,source_id" });
        if (upsertError) throw upsertError;
      }

      page++;
    }

    // Candidatos pendientes que llevan STALE_AFTER_DAYS sin aparecer en la
    // fuente -> 'desaparecido'. Nunca se borran, nunca se toca algo que el
    // admin ya haya aprobado/descartado.
    const staleThreshold = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: staleRows, error: staleError } = await supabase
      .from("event_candidates")
      .update({ estado: "desaparecido" })
      .eq("source", "ticketmaster")
      .eq("estado", "pendiente")
      .lt("last_seen_at", staleThreshold)
      .not("source_id", "in", `(${seenSourceIds.map((id) => `"${id}"`).join(",") || '""'})`)
      .select("id");
    if (staleError) throw staleError;

    return new Response(
      JSON.stringify({
        pages_fetched: page,
        events_seen: seenSourceIds.length,
        created,
        updated,
        incomplete,
        possible_duplicates: possibleDuplicates,
        cancelled_flagged: cancelled,
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
