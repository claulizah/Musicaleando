import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin-only: the curator pastes a URL and this fetches that single page
// server-side, strips it to visible text, and sends it to Claude to
// propose event(s). Handles two page shapes with ONE generic prompt (no
// per-boletera hardcoding — the same call works for any ticketing site):
//   - A single-event page (venue/promoter/social post for one show): the
//     model returns a one-item "eventos" array, same as before this page
//     also handled listings.
//   - A listing/cartelera page (a boletera's "Conciertos" category page):
//     the model returns multiple items, one per event it can identify.
// Same JSON contract either way — "eventos" is always an array — so the
// admin UI just branches on its length instead of needing a separate
// endpoint or a pre-classification step.
// This is a one-off fetch of a URL the curator explicitly gave, never a
// crawler: no following links, no pagination/scroll simulation, no repeat
// fetches of the same URL, no queue.

const ANTHROPIC_API_KEY = Deno.env.get("API_CONSOLE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-5";

// A listing page has a lot more text than a single-event page (dozens of
// event blocks) — bumped up from the single-event-only version of this
// function, still bounded.
const MAX_TEXT_CHARS = 40000;
const FETCH_TIMEOUT_MS = 10000;

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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "No autorizado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "No autorizado." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Solo administradores." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Falta el secreto API_CONSOLE_KEY." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      return new Response(JSON.stringify({ error: "Falta la URL." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "La URL no es válida." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Solo se aceptan URLs http/https." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let pageHtml: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const pageRes = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          // Identifies the curator-triggered fetcher — a single page,
          // requested once, not a crawler pretending to be a browser.
          "User-Agent": "MusicaleandoEventBot/1.0 (+https://musicaleando.com; curator-triggered single-page fetch)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      clearTimeout(timeout);
      if (!pageRes.ok) {
        return new Response(
          JSON.stringify({ error: `La página respondió ${pageRes.status}. Puede requerir login o estar bloqueando bots — completa el formulario a mano.` }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }
      pageHtml = await pageRes.text();
    } catch (fetchErr) {
      const timedOut = fetchErr instanceof Error && fetchErr.name === "AbortError";
      return new Response(
        JSON.stringify({
          error: timedOut
            ? "La página tardó demasiado en responder. Completa el formulario a mano."
            : "No se pudo leer esa página (puede requerir login o ser una app que no muestra contenido sin JavaScript). Completa el formulario a mano.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const text = stripHtmlToText(pageHtml).slice(0, MAX_TEXT_CHARS);
    if (text.length < 50) {
      return new Response(
        JSON.stringify({ error: "La página no tiene suficiente texto legible (puede ser una app de una sola página que carga todo con JavaScript). Completa el formulario a mano." }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        // A listing page can report dozens of events — 4000 (the
        // single-event version's budget) risks truncating the JSON
        // mid-response once there's more than a handful of events.
        max_tokens: 16000,
        messages: [{ role: "user", content: LINK_EXTRACTION_PROMPT + text }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Anthropic API failed: ${res.status} ${errText}`);
      return new Response(JSON.stringify({ error: `Anthropic respondió ${res.status}.` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const textBlock = (data.content ?? []).find((c) => c.type === "text")?.text ?? "";
    const cleaned = textBlock.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    type ParsedEvento = {
      nombre?: string | null;
      tipo?: string | null;
      fecha_inicio?: string | null;
      fecha_fin?: string | null;
      ciudad?: string | null;
      venue?: string | null;
      bloques?: { escenario: string | null; artista: string; hora_inicio: string | null }[];
    };
    let parsed: { es_listado?: boolean; eventos?: ParsedEvento[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Could not parse model output as JSON:", textBlock);
      return new Response(
        JSON.stringify({ error: "La IA no devolvió un JSON válido. Intenta de nuevo o completa el formulario a mano." }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
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

    return new Response(
      JSON.stringify({ esListado: Boolean(parsed.es_listado), eventos }),
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
