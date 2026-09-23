// Lógica pura de eticket-sync (parseo, normalización, deduplicación) — sin
// ningún import específico de Deno, para poder correr las pruebas unitarias
// con Node (ver tests/unit/eticketSync.test.mts). index.ts importa esto y le
// agrega la parte que sí necesita el runtime de Supabase (fetch a la fuente,
// lectura/escritura en la base).

export type LdOffer = { price?: number; priceCurrency?: string };
export type LdEvent = {
  "@type"?: string;
  name?: string;
  url?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  eventStatus?: string;
  performer?: { name?: string } | { name?: string }[];
  location?: { name?: string; address?: { addressLocality?: string; addressRegion?: string } };
  offers?: LdOffer[];
};

// Mismo criterio de "posible duplicado" que ticketmaster-sync: nombre
// normalizado que se contiene mutuamente + fecha dentro de 1 día + ciudad
// que se contiene mutuamente cuando ambas existen. Contra TODOS los
// festivales (activos y archivados) — un evento que ya se archivó (pasó,
// se canceló) no debe volver como candidato nuevo.
export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findPossibleDuplicate(
  event: { nombre: string; ciudad: string | null; fecha_inicio: string | null },
  festivals: { id: string; nombre: string; ciudad: string; fecha_inicio: string }[],
): string | null {
  const normName = normalizeText(event.nombre);
  for (const f of festivals) {
    const normFestName = normalizeText(f.nombre);
    const namesMatch = normName === normFestName || normName.includes(normFestName) || normFestName.includes(normName);
    if (!namesMatch) continue;
    if (event.fecha_inicio) {
      const diffDays = Math.abs(new Date(event.fecha_inicio).getTime() - new Date(f.fecha_inicio).getTime()) / 86_400_000;
      if (diffDays > 1) continue;
    }
    if (event.ciudad && f.ciudad) {
      const ciudadesMatch = normalizeText(event.ciudad).includes(normalizeText(f.ciudad)) || normalizeText(f.ciudad).includes(normalizeText(event.ciudad));
      if (!ciudadesMatch) continue;
    }
    return f.id;
  }
  return null;
}

// "Capitalización" — eticket.mx publica nombre/venue/ciudad TODO EN
// MAYÚSCULAS en su JSON-LD (a diferencia de Ticketmaster, que ya da buena
// capitalización). NO se re-castea a ciegas: un nombre artístico real puede
// venir estilizado en mayúsculas a propósito (mismo criterio documentado en
// admin/src/lib/cleanEventName.ts — esa función nunca re-castea por esto
// mismo). Aquí el caso es distinto: es la FUENTE la que solo tiene
// mayúsculas, no el artista, así que se aplica Title Case SOLO cuando la
// cadena original viene 100% en mayúsculas (si trae minúsculas, se asume
// intencional y se deja intacta). Conectores en español quedan en minúscula
// salvo al inicio.
const CONECTORES = new Set(["de", "del", "la", "las", "el", "los", "y", "en", "con", "a", "al", "un", "una"]);
export function titleCaseIfShouting(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s || s !== s.toUpperCase() || s === s.toLowerCase()) return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (i > 0 && CONECTORES.has(word)) return word;
      // Preserva guiones internos capitalizando cada tramo ("sub-cero" -> "Sub-Cero").
      return word
        .split("-")
        .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
        .join("-");
    })
    .join(" ");
}

export function extractLdEvents(html: string): LdEvent[] {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/g)];
  const events: LdEvent[] = [];
  for (const [, json] of blocks) {
    try {
      const parsed = JSON.parse(json);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) if (item?.["@type"] === "Event") events.push(item);
    } catch {
      // Un bloque JSON-LD malformado no debe tumbar el resto — se ignora ese bloque.
    }
  }
  return events;
}

export function performerName(p: LdEvent["performer"]): string | null {
  const first = Array.isArray(p) ? p[0] : p;
  const name = first?.name?.trim();
  // eticket.mx trae un evento de prueba propio con un performer placeholder
  // — no es un artista real, no debe llegar como lineup ni contarse como dato válido.
  if (!name || /^artista de prueba$/i.test(name)) return null;
  return name;
}

export function sourceIdFromUrl(url: string | undefined): string | null {
  const m = /[?&]idevento=(\d+)/.exec(url ?? "");
  return m ? m[1] : null;
}

function rawPerformerName(p: LdEvent["performer"]): string {
  const first = Array.isArray(p) ? p[0] : p;
  return first?.name?.trim() ?? "";
}

export function normalizeEvent(ev: LdEvent) {
  const sourceId = sourceIdFromUrl(ev.url);
  const nombreRaw = (ev.name ?? "").trim();
  // El propio evento de prueba de eticket ("EVENTO ARTISTA FAVORITO 2025",
  // performer "Artista de prueba", precio $0.01) no es un evento real — se
  // descarta aquí, nunca llega como candidato. Se detecta por el performer
  // placeholder (el nombre del evento en sí no siempre dice "prueba").
  const esEventoDePrueba = /prueba/i.test(rawPerformerName(ev.performer)) || /prueba/i.test(nombreRaw);
  const nombre = titleCaseIfShouting(nombreRaw);
  const venue = ev.location?.name ? titleCaseIfShouting(ev.location.name.trim()) : null;
  const ciudad = ev.location?.address?.addressLocality
    ? titleCaseIfShouting(ev.location.address.addressLocality.trim())
    : null;
  const fecha_inicio = ev.startDate ? ev.startDate.slice(0, 10) : null;
  const fecha_fin = ev.endDate ? ev.endDate.slice(0, 10) : fecha_inicio;
  const prices = (ev.offers ?? []).map((o) => o.price).filter((p): p is number => typeof p === "number" && p > 0);
  const performer = performerName(ev.performer);
  const status = ev.eventStatus?.split("/").pop() ?? "EventScheduled";

  return {
    source: "eticket" as const,
    source_id: sourceId,
    nombre,
    ciudad,
    venue,
    fecha_inicio,
    fecha_fin,
    lineup: performer ? [performer] : [],
    price_min: prices.length ? Math.min(...prices) : null,
    price_max: prices.length ? Math.max(...prices) : null,
    price_currency: ev.offers?.[0]?.priceCurrency ?? null,
    link_boletos: ev.url ?? null,
    image_url: typeof ev.image === "string" && ev.image.startsWith("http") ? ev.image : null,
    raw_payload: ev as unknown as Record<string, unknown>,
    completo: Boolean(nombre && ciudad && fecha_inicio && ev.url),
    cancelado_o_pospuesto: status === "EventCancelled" || status === "EventPostponed",
    esEventoDePrueba,
  };
}
