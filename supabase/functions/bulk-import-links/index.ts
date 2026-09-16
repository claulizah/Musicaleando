import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// One-off bulk loader for "already-published events on API-less boleteras"
// (Eticket, Superboletos, AREMA, etc.) — the heavy one-time catch-up load
// Claudia asked for, so pasting dozens of links one at a time into the
// admin UI isn't the only option. Meant to be run manually from a local
// script against a list of URLs (see bulk-import-links.mjs at the repo
// root) — NOT wired to any cron, and not reachable from the admin UI.
// Deployed with --no-verify-jwt and gated by a shared secret (x-import-
// secret / BULK_IMPORT_SECRET), same pattern as ticketmaster-sync, since
// there's no interactive admin session driving this.
//
// Extraction logic (fetch one URL server-side, strip to text, ask Claude
// for an "eventos" array) is copied verbatim from
// extract-event-from-link/index.ts, not reimplemented — Edge Functions in
// this repo don't share modules with each other (no _shared/ convention
// here), so an exact copy is the closest thing to "reuse" available. Same
// for the festivals/pending-candidates duplicate check, copied from
// ticketmaster-sync's normalize()/findPossibleDuplicate(), extended (like
// candidatos/actions.ts's admin-UI version already was) to also check
// pending candidates, not just approved festivals.
//
// Every accepted event lands in event_candidates as 'pendiente' — nothing
// is ever inserted into `festivals` directly. Duplicates (against an
// approved festival OR another pending candidate) are skipped rather than
// created, since this runs unattended with no curator watching to flag them
// for review one by one.
//
// Processes URLs one at a time with a pause between each (RATE_LIMIT_MS) —
// still one fetch per URL the caller explicitly listed, no crawling, no
// pagination, no following links; the pacing is only to avoid hammering a
// third-party boletera's server in a tight burst across dozens of requests.

const ANTHROPIC_API_KEY = Deno.env.get("API_CONSOLE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IMPORT_SECRET = Deno.env.get("BULK_IMPORT_SECRET");
const ANTHROPIC_MODEL = "claude-sonnet-5";

const MAX_TEXT_CHARS = 40000;
const FETCH_TIMEOUT_MS = 10000;
const RATE_LIMIT_MS = 1500;
const MAX_URLS_PER_CALL = 20; // caller loops for a longer list; keeps one invocation well under Edge Function time limits

const LINK_EXTRACTION_PROMPT = `El siguiente es el texto visible (etiquetas HTML ya removidas) de una página web de una boletera, venue, promotora o red social. Puede describir UN SOLO concierto/festival, o ser una página de listado/cartelera con VARIOS eventos distintos (ej. una categoría "Conciertos" de un sitio de boletos).

Identifica cada evento musical distinto que el texto describa con al menos un nombre reconocible, y para cada uno extrae SOLO lo que puedas leer con confianza real — nunca inventes ni adivines un dato que no esté claramente presente, es preferible dejar un campo en null que adivinar. El texto puede incluir navegación, menús, otros eventos no musicales, u otro contenido irrelevante — ignóralo.

Para "tipo": infiere "festival" si ese evento describe un line-up con varios artistas, o "concierto" si es claramente un solo artista/acto principal. Si no está claro, deja "tipo" en null.

Si la página es un listado con eventos que el texto no llegó a describir completo (por ejemplo, quedaron cortados porque la página tiene más resultados que no caben en este texto, o pide cargar más), igual reporta los que sí alcanzaste a leer completos — no los omitas ni los inventes completos.

Responde ÚNICAMENTE con un JSON válido (sin texto antes ni después, sin bloques de código markdown) con esta forma exacta:

{
  "es_listado": boolean,
  "eventos": [
    {
      "nombre": string | null,
      "tipo": "festival" | "concierto" | null,
      "fecha_inicio": string | null,
      "fecha_fin": string | null,
      "ciudad": string | null,
      "venue": string | null,
      "bloques": [
        { "escenario": string | null, "artista": string, "hora_inicio": string | null }
      ]
    }
  ]
}

Si el texto no describe ningún evento identificable, responde con "es_listado": false y "eventos": [].

--- TEXTO DE LA PÁGINA ---
`;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ExtractedEvento = {
  nombre: string | null;
  tipo: "festival" | "concierto" | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  ciudad: string | null;
  venue: string | null;
  bloques: { escenario: string | null; artista: string; hora_inicio: string | null }[];
};

async function extractEventsFromUrl(url: string): Promise<{ events?: ExtractedEvento[]; error?: string }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { error: "URL inválida." };
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { error: "Solo se aceptan URLs http/https." };
  }

  let pageHtml: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const pageRes = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "MusicaleandoEventBot/1.0 (+https://musicaleando.com; one-time bulk catalog import, one request per listed URL)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);
    if (!pageRes.ok) {
      return { error: `La página respondió ${pageRes.status} (posible bloqueo de bots o login requerido).` };
    }
    pageHtml = await pageRes.text();
  } catch (fetchErr) {
    const timedOut = fetchErr instanceof Error && fetchErr.name === "AbortError";
    return { error: timedOut ? "Tiempo de espera agotado." : "No se pudo leer la página (login requerido o SPA sin contenido server-rendered)." };
  }

  const text = stripHtmlToText(pageHtml).slice(0, MAX_TEXT_CHARS);
  if (text.length < 50) {
    return { error: "Muy poco texto legible (probable SPA que carga todo con JavaScript)." };
  }

  if (!ANTHROPIC_API_KEY) return { error: "Falta el secreto API_CONSOLE_KEY." };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: LINK_EXTRACTION_PROMPT + text }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Anthropic API failed: ${res.status} ${errText}`);
    return { error: `Anthropic respondió ${res.status}.` };
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const textBlock = (data.content ?? []).find((c) => c.type === "text")?.text ?? "";
  const cleaned = textBlock.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let parsed: { eventos?: ExtractedEvento[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("Could not parse model output as JSON:", textBlock);
    return { error: "La IA no devolvió un JSON válido." };
  }

  const eventos = (Array.isArray(parsed.eventos) ? parsed.eventos : []).map((e) => ({
    nombre: e.nombre ?? null,
    tipo: e.tipo === "festival" || e.tipo === "concierto" ? e.tipo : null,
    fecha_inicio: e.fecha_inicio ?? null,
    fecha_fin: e.fecha_fin ?? null,
    ciudad: e.ciudad ?? null,
    venue: e.venue ?? null,
    bloques: Array.isArray(e.bloques) ? e.bloques : [],
  }));

  return { events: eventos };
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findDuplicate(
  event: { nombre: string; ciudad: string | null; fecha_inicio: string | null },
  festivals: { id: string; nombre: string; ciudad: string; fecha_inicio: string }[],
  candidates: { id: string; nombre: string; ciudad: string | null; fecha_inicio: string | null }[],
): boolean {
  const normName = normalize(event.nombre);
  const matches = (nombre: string, ciudad: string | null, fecha_inicio: string | null) => {
    const normOther = normalize(nombre);
    const namesMatch = normName === normOther || normName.includes(normOther) || normOther.includes(normName);
    if (!namesMatch) return false;
    if (event.fecha_inicio && fecha_inicio) {
      const diffDays = Math.abs(new Date(event.fecha_inicio).getTime() - new Date(fecha_inicio).getTime()) / 86_400_000;
      if (diffDays > 1) return false;
    }
    if (event.ciudad && ciudad) {
      const ciudadesMatch = normalize(event.ciudad).includes(normalize(ciudad)) || normalize(ciudad).includes(normalize(event.ciudad));
      if (!ciudadesMatch) return false;
    }
    return true;
  };
  return festivals.some((f) => matches(f.nombre, f.ciudad, f.fecha_inicio)) || candidates.some((c) => matches(c.nombre, c.ciudad, c.fecha_inicio));
}

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

  if (!IMPORT_SECRET || req.headers.get("x-import-secret") !== IMPORT_SECRET) {
    return new Response(JSON.stringify({ error: "No autorizado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const urls = Array.isArray(body.urls) ? body.urls.filter((u: unknown) => typeof u === "string") : [];
  if (urls.length === 0) {
    return new Response(JSON.stringify({ error: "Falta 'urls' (array de strings)." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (urls.length > MAX_URLS_PER_CALL) {
    return new Response(
      JSON.stringify({ error: `Máximo ${MAX_URLS_PER_CALL} URLs por llamada — el script que llama a esto debe trocear la lista.` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Fetched once, reused for every URL/event in this call.
  const [{ data: festivals }, { data: pendingCandidates }] = await Promise.all([
    supabase.from("festivals").select("id, nombre, ciudad, fecha_inicio"),
    supabase.from("event_candidates").select("id, nombre, ciudad, fecha_inicio").eq("estado", "pendiente"),
  ]);
  const festivalRows = festivals ?? [];
  const candidateRows = pendingCandidates ?? [];

  const results: {
    url: string;
    error?: string;
    eventsFound: number;
    created: number;
    skippedDuplicates: number;
    insertErrors?: string[];
  }[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (i > 0) await sleep(RATE_LIMIT_MS);

    const { events, error } = await extractEventsFromUrl(url);
    if (error || !events) {
      results.push({ url, error: error ?? "Sin eventos.", eventsFound: 0, created: 0, skippedDuplicates: 0 });
      continue;
    }

    let created = 0;
    let skipped = 0;
    const insertErrors: string[] = [];
    for (const event of events) {
      if (!event.nombre) {
        insertErrors.push('Evento sin nombre (no se pudo leer con confianza) — omitido.');
        continue;
      }
      const isDup = findDuplicate({ nombre: event.nombre, ciudad: event.ciudad, fecha_inicio: event.fecha_inicio }, festivalRows, candidateRows);
      if (isDup) {
        skipped++;
        continue;
      }
      const { error: insertError } = await supabase.from("event_candidates").insert({
        source: "carga_inicial",
        source_id: crypto.randomUUID(),
        nombre: event.nombre,
        tipo: event.tipo,
        ciudad: event.ciudad,
        venue: event.venue,
        fecha_inicio: event.fecha_inicio,
        fecha_fin: event.fecha_fin,
        lineup: event.bloques.map((b) => ({ artista: b.artista, escenario: b.escenario, horario: b.hora_inicio })),
        completo: Boolean(event.nombre && event.ciudad && event.fecha_inicio),
        raw_payload: { source_url: url },
        link_boletos: url,
        price_min: null,
        price_max: null,
        price_currency: null,
        possible_duplicate_of: null,
        festival_id: null,
      });
      if (insertError) {
        console.error(`Insert failed for "${event.nombre}" from ${url}:`, insertError);
        insertErrors.push(`"${event.nombre}": ${insertError.message}`);
        continue;
      }
      created++;
      // So a later event in this same batch (or a later URL in this same
      // call) can be deduped against what this call has already created,
      // not just what existed before it started.
      candidateRows.push({ id: "", nombre: event.nombre, ciudad: event.ciudad, fecha_inicio: event.fecha_inicio });
    }

    results.push({ url, eventsFound: events.length, created, skippedDuplicates: skipped, insertErrors: insertErrors.length > 0 ? insertErrors : undefined });
  }

  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
});
