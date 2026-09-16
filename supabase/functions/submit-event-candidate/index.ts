import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Public, unauthenticated endpoint (deployed with --no-verify-jwt) behind
// musicaleando.com/sugerir-evento. Anyone can suggest an event; this writes
// with the service role key so event_candidates' admin-only RLS policies
// never need loosening for anonymous callers. Every submission lands as
// 'pendiente' — same curator-approval gate as every other source.

const ANTHROPIC_API_KEY = Deno.env.get("API_CONSOLE_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-5";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5;

const POSTER_EXTRACTION_PROMPT = `Esta imagen es un póster/flyer de un concierto o festival de música. Extrae SOLO lo que puedas leer con confianza real — nunca inventes ni adivines. Para "tipo": "festival" si hay un line-up con varios artistas, "concierto" si es un solo acto, null si no está claro.

Responde ÚNICAMENTE con un JSON válido con esta forma exacta:
{
  "evento": { "nombre": string | null, "tipo": "festival" | "concierto" | null, "fecha_inicio": string | null, "fecha_fin": string | null, "ciudad": string | null, "venue": string | null },
  "bloques": [ { "escenario": string | null, "artista": string, "hora_inicio": string | null } ]
}
Si la imagen no es un póster de evento, responde con "evento" en null y "bloques": [].`;

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
      const diffDays = Math.abs(new Date(event.fecha_inicio).getTime() - new Date(f.fecha_inicio).getTime()) / 86_400_000;
      if (diffDays > 1) continue;
    }
    if (event.ciudad && f.ciudad) {
      const ciudadesMatch = normalize(event.ciudad).includes(normalize(f.ciudad)) || normalize(f.ciudad).includes(normalize(event.ciudad));
      if (!ciudadesMatch) continue;
    }
    return f.id;
  }
  return null;
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Configuración incompleta del servidor." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Best-effort real client IP — Cloudflare/Supabase set this on the way in.
  // Never stored raw, only hashed, and only used for rate limiting.
  const clientIp = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = await hashIp(clientIp);

  try {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count } = await supabase
      .from("event_submission_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);

    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({ error: "Demasiadas sugerencias desde este lugar en poco tiempo. Intenta de nuevo más tarde." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    // Recorded regardless of outcome below (including the honeypot branch)
    // so a bot retrying doesn't get unlimited free attempts.
    await supabase.from("event_submission_attempts").insert({ ip_hash: ipHash });

    const body = await req.json().catch(() => ({}));

    // Honeypot: a real visitor never fills this (it's hidden via CSS in the
    // form). Pretend success so a bot doesn't learn to avoid the field.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }

    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre) {
      return new Response(JSON.stringify({ error: "El nombre del evento es obligatorio." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const submittedFecha = typeof body.fecha_inicio === "string" ? body.fecha_inicio.trim() || null : null;
    const submittedCiudad = typeof body.ciudad === "string" ? body.ciudad.trim() || null : null;
    const submittedVenue = typeof body.venue === "string" ? body.venue.trim() || null : null;
    const submittedLink = typeof body.link === "string" ? body.link.trim() || null : null;
    const posterBase64 = typeof body.poster_base64 === "string" ? body.poster_base64 : null;
    const posterMediaType = typeof body.poster_media_type === "string" ? body.poster_media_type : "image/jpeg";

    let extracted: {
      tipo: string | null;
      fecha_inicio: string | null;
      ciudad: string | null;
      venue: string | null;
      lineup: { artista: string; escenario: string | null; horario: string | null }[];
    } = { tipo: null, fecha_inicio: null, ciudad: null, venue: null, lineup: [] };
    let posterUrl: string | null = null;

    if (posterBase64 && ANTHROPIC_API_KEY) {
      try {
        const bytes = Uint8Array.from(atob(posterBase64), (c) => c.charCodeAt(0));
        const ext = posterMediaType.includes("png") ? "png" : posterMediaType.includes("webp") ? "webp" : "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("event-submission-posters")
          .upload(path, bytes, { contentType: posterMediaType });
        if (!uploadError) {
          posterUrl = supabase.storage.from("event-submission-posters").getPublicUrl(path).data.publicUrl;
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
            max_tokens: 4000,
            messages: [
              {
                role: "user",
                content: [
                  { type: "image", source: { type: "base64", media_type: posterMediaType, data: posterBase64 } },
                  { type: "text", text: POSTER_EXTRACTION_PROMPT },
                ],
              },
            ],
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { content?: { type: string; text?: string }[] };
          const textBlock = (data.content ?? []).find((c) => c.type === "text")?.text ?? "";
          const cleaned = textBlock.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
          const parsed = JSON.parse(cleaned) as {
            evento?: { tipo?: string | null; fecha_inicio?: string | null; ciudad?: string | null; venue?: string | null };
            bloques?: { escenario: string | null; artista: string; hora_inicio: string | null }[];
          };
          extracted = {
            tipo: parsed.evento?.tipo === "festival" || parsed.evento?.tipo === "concierto" ? parsed.evento.tipo : null,
            fecha_inicio: parsed.evento?.fecha_inicio ?? null,
            ciudad: parsed.evento?.ciudad ?? null,
            venue: parsed.evento?.venue ?? null,
            lineup: (parsed.bloques ?? []).map((b) => ({ artista: b.artista, escenario: b.escenario, horario: b.hora_inicio })),
          };
        }
      } catch (extractErr) {
        // Extraction failing must never block the submission itself — the
        // curator still gets the raw text fields and the poster image.
        console.error("Poster extraction failed (non-fatal):", extractErr);
      }
    }

    // El texto que la persona escribió a mano siempre gana sobre lo que la
    // IA leyó del póster — nunca se pisa un dato que el usuario sí dio.
    const fecha_inicio = submittedFecha ?? extracted.fecha_inicio;
    const ciudad = submittedCiudad ?? extracted.ciudad;
    const venue = submittedVenue ?? extracted.venue;

    let possibleDuplicateOf: string | null = null;
    const { data: festivals } = await supabase.from("festivals").select("id, nombre, ciudad, fecha_inicio");
    possibleDuplicateOf = findPossibleDuplicate({ nombre, ciudad, fecha_inicio }, festivals ?? []);

    const { error: insertError } = await supabase.from("event_candidates").insert({
      source: "sumision_publica",
      source_id: crypto.randomUUID(),
      nombre,
      tipo: extracted.tipo,
      ciudad,
      venue,
      fecha_inicio,
      fecha_fin: null,
      lineup: extracted.lineup,
      completo: Boolean(nombre && ciudad && fecha_inicio),
      possible_duplicate_of: possibleDuplicateOf,
      raw_payload: { submitted_link: submittedLink, poster_url: posterUrl },
    });
    if (insertError) throw insertError;

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "No se pudo guardar la sugerencia. Intenta de nuevo." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
