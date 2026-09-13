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

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Falta el secreto API_CONSOLE_KEY." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const imageBase64 = typeof body.image_base64 === "string" ? body.image_base64 : "";
    const mediaType = typeof body.media_type === "string" ? body.media_type : "image/png";
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
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: EXTRACTION_PROMPT },
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

    let parsed: { es_horario_con_tiempos?: boolean; dia_label?: string | null; bloques?: ExtractedBlock[] };
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
