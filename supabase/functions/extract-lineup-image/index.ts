import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin-only: sends an admin-uploaded festival schedule image to Claude
// (vision) and returns a structured extraction of {escenario, artista,
// hora_inicio, hora_fin} blocks. Writes nothing itself — same "extract and
// return, the caller inserts as pendiente" pattern as lastfm-mood-sync. The
// admin panel's server action is what actually creates
// festival_lineup_candidates rows, using the admin's own session (RLS).

const ANTHROPIC_API_KEY = Deno.env.get("API_CONSOLE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-5";

// 30/hora por admin — generoso para una sesión real de curación, pero acota
// el costo si algo dispara llamadas en loop. Ver
// prompt-siguiente-salud-sistema.md.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 30;

const EXTRACTION_PROMPT = `Esta imagen es un cartel/horario de un festival de música mexicano. Puede venir en dos formatos:
1. Un grid de horarios: columnas por escenario, filas por hora, cada artista en un bloque de color con su rango de horario.
2. Un cartel de anuncio de line-up SIN horarios (solo nombres de artistas agrupados por día, sin grid de tiempo).

Tu tarea es extraer SOLO lo que puedas leer con confianza real. Nunca inventes ni adivines un horario, escenario o nombre de artista que no puedas leer claramente en la imagen — es preferible dejar un campo en null o bajar la confianza a "baja" que adivinar. Si el bloque de un artista no tiene escenario visible, deja escenario en null. Si no puedes leer el horario de inicio o fin de un bloque, deja ese campo en null.

Responde ÚNICAMENTE con un JSON válido (sin texto antes ni después, sin bloques de código markdown) con esta forma exacta:

{
  "es_horario_con_tiempos": boolean,  // true solo si la imagen SÍ tiene un grid de horarios legible; false si es un cartel de anuncio sin horarios o si la imagen no es de un festival
  "dia_label": string | null,  // el día/fecha tal como aparece en la imagen, ej. "Domingo 16", "Viernes 4 Abril" — null si no es visible
  "bloques": [
    {
      "escenario": string | null,
      "artista": string,
      "hora_inicio": string | null,  // tal como aparece en la imagen, ej. "20:20" o "8:10" — no conviertas ni asumas AM/PM si no es claro
      "hora_fin": string | null,
      "confianza": "alta" | "media" | "baja",
      "nota": string | null  // ej. "letra pequeña, posible error de lectura", "no legible"
    }
  ]
}

Si la imagen no contiene ningún artista identificable de un festival, responde con "bloques": [] y "es_horario_con_tiempos": false.`;

// Same image, richer ask: used when the curator is adding a brand-new event
// (not yet in the catalog) from a poster/flyer/line-up announcement, so the
// event-level fields (nombre, tipo, fechas, ciudad/venue) matter as much as
// the lineup blocks. Kept as a second prompt rather than always asking for
// "evento" so the existing per-festival lineup-import call (which already
// has a known festival_id and doesn't need event metadata) stays unchanged.
const EVENT_EXTRACTION_PROMPT = `Esta imagen es un póster/flyer/anuncio de un concierto o festival de música (puede o no traer un grid de horarios).

Extrae SOLO lo que puedas leer con confianza real — nunca inventes ni adivines un dato que no esté claramente legible en la imagen (nombre, fecha, ciudad/venue, precio). Es preferible dejar un campo en null que adivinar.

Para "tipo": infiere "festival" si el póster muestra un line-up con varios artistas (aunque no todos tengan el mismo peso visual), o "concierto" si es claramente un solo artista/acto principal sin otros nombres de line-up. Si no está claro (por ejemplo, solo un logo/nombre de evento sin lista de artistas), deja "tipo" en null — no adivines a ciegas.

Responde ÚNICAMENTE con un JSON válido (sin texto antes ni después, sin bloques de código markdown) con esta forma exacta:

{
  "evento": {
    "nombre": string | null,
    "tipo": "festival" | "concierto" | null,
    "fecha_inicio": string | null,  // formato YYYY-MM-DD si se puede inferir el año con confianza (ej. el póster trae el año completo); si solo hay día/mes sin año, deja null
    "fecha_fin": string | null,
    "ciudad": string | null,
    "venue": string | null
  },
  "es_horario_con_tiempos": boolean,
  "dia_label": string | null,
  "bloques": [
    {
      "escenario": string | null,
      "artista": string,
      "hora_inicio": string | null,
      "hora_fin": string | null,
      "confianza": "alta" | "media" | "baja",
      "nota": string | null
    }
  ]
}

Si la imagen no es un póster de evento reconocible, responde con "evento" con todos los campos en null, "bloques": [] y "es_horario_con_tiempos": false.`;

type ExtractedBlock = {
  escenario: string | null;
  artista: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  confianza: "alta" | "media" | "baja";
  nota: string | null;
};

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

    // Segunda capa de defensa (no es el caso de abuso público — ya está
    // gateado por is_admin arriba) contra un loop/bug o una sesión de admin
    // comprometida disparando llamadas pagadas a Claude sin límite.
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: recentCalls } = await supabase
      .from("admin_ai_calls")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", user.id)
      .gte("created_at", since);
    if ((recentCalls ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: "Demasiadas extracciones en poco tiempo. Espera unos minutos e intenta de nuevo." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }
    await supabase.from("admin_ai_calls").insert({ admin_id: user.id, function_name: "extract-lineup-image" });

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Falta el secreto API_CONSOLE_KEY." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64 : "";
    const mediaType = typeof body.media_type === "string" ? body.media_type : "image/png";
    const extractEventInfo = Boolean(body.extract_event_info);
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Falta la imagen." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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
        // Dense grids/posters can have 40-60+ blocks — 4096 was cutting the
        // JSON off mid-string on real festival images (confirmed against
        // Corona Capital/Tecate Pa'l Norte test images, see ESTADO.md).
        max_tokens: 16000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: extractEventInfo ? EVENT_EXTRACTION_PROMPT : EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Anthropic API failed: ${res.status} ${text}`);
      return new Response(JSON.stringify({ error: `Anthropic respondió ${res.status}: ${text}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const textBlock = (data.content ?? []).find((c) => c.type === "text")?.text ?? "";

    // Model is instructed to return raw JSON, but strip markdown fences
    // defensively in case it wraps the response anyway.
    const cleaned = textBlock.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: {
      es_horario_con_tiempos?: boolean;
      dia_label?: string | null;
      bloques?: ExtractedBlock[];
      evento?: {
        nombre?: string | null;
        tipo?: string | null;
        fecha_inicio?: string | null;
        fecha_fin?: string | null;
        ciudad?: string | null;
        venue?: string | null;
      };
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Could not parse model output as JSON:", textBlock);
      return new Response(
        JSON.stringify({ error: "La IA no devolvió un JSON válido. Intenta de nuevo o con otra imagen." }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        es_horario_con_tiempos: Boolean(parsed.es_horario_con_tiempos),
        dia_label: parsed.dia_label ?? null,
        bloques: Array.isArray(parsed.bloques) ? parsed.bloques : [],
        evento: extractEventInfo
          ? {
              nombre: parsed.evento?.nombre ?? null,
              tipo: parsed.evento?.tipo === 'festival' || parsed.evento?.tipo === 'concierto' ? parsed.evento.tipo : null,
              fecha_inicio: parsed.evento?.fecha_inicio ?? null,
              fecha_fin: parsed.evento?.fecha_fin ?? null,
              ciudad: parsed.evento?.ciudad ?? null,
              venue: parsed.evento?.venue ?? null,
            }
          : undefined,
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
