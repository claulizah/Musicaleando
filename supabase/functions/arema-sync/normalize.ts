// Lógica pura del sync de Arema (sin imports de Deno, para probarla con
// Node — ver tests/unit/aremaSync.test.mts). Mismo patrón que
// eticket-sync/normalize.ts.

// Un evento tal como lo devuelve POST https://t3lb.arema.mx/public/events/list
// (API pública sin autenticación; es la misma que consulta la página de
// arema.mx al cargar).
export type AremaEvent = {
  event_id: number;
  event_name: string;
  subdomain: string | null;
  category_id: number;
  category_name: string;
  date: number; // timestamp Unix (segundos) — la hora REAL del evento
  venue_id: number;
  venue_name: string | null;
  city: string | null;
  state: string | null;
  poster: string | null;
};

// Solo música. El catálogo de Arema también vende Comediantes, Teatro,
// Especiales, Familiares, Conferencia y Deportes — fuera del alcance.
export const CATEGORIA_MUSICA = "Concierto";

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Zona horaria con la que Arema codifica `date`. Se probó contra el texto de
// los propios eventos (la sinopsis dice "**Hora:** 19:00 horas"): en los
// conciertos de estados con otra zona (Tijuana, Sonora) la hora del texto
// coincide con el Unix leído en hora del CENTRO de México (Tijuana 2 de 4
// vs 1 de 4 con America/Tijuana; Sonora 1 de 1 vs 0 de 1; el resto de zonas
// coincide igual). La muestra es chica, pero apunta a que Arema guarda toda
// hora "de pared" como hora del centro, así que se usa America/Mexico_City
// para todo (convertir con la zona real del estado desfasaría la hora una
// hora respecto a lo que Arema muestra). Si un día se demuestra lo contrario,
// este es el único lugar que hay que cambiar.
export const AREMA_TIME_ZONE = "America/Mexico_City";
export function timeZoneFor(_state: string | null, _city: string | null): string {
  return AREMA_TIME_ZONE;
}

// Fecha y hora LOCALES del evento a partir del timestamp Unix real.
export function localDateTime(unixSeconds: number, timeZone: string): { fecha: string; hora: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(unixSeconds * 1000));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

// La respuesta debe tener la forma esperada; si cambió (campo faltante,
// estructura distinta), se falla en voz alta en vez de traer datos vacíos o
// corruptos en silencio.
export function parseEventList(json: unknown): AremaEvent[] {
  const data = (json as { error?: unknown; data?: { events?: unknown } })?.data;
  if ((json as { error?: unknown })?.error) throw new Error("Arema respondió error=true en events/list.");
  if (!data || !Array.isArray(data.events)) throw new Error("Arema events/list: falta data.events (¿cambió la API?).");
  const events = data.events as AremaEvent[];
  if (events.length === 0) throw new Error("Arema events/list devolvió 0 eventos — se aborta en vez de marcar todo como desaparecido.");
  const sample = events[0];
  for (const k of ["event_id", "event_name", "category_name", "date"] as const) {
    if (sample[k] === undefined || sample[k] === null) throw new Error(`Arema events/list: el evento no trae "${k}" (¿cambió la API?).`);
  }
  return events;
}

export function normalizeEvent(ev: AremaEvent) {
  const nombre = (ev.event_name ?? "").replace(/^[“"']+|[”"']+$/g, "").trim();
  const tz = timeZoneFor(ev.state, ev.city);
  const { fecha, hora } = localDateTime(ev.date, tz);
  const ciudad = ev.city?.trim() || null;
  // El link se arma solo con el ID: la API no trae slug y la página de
  // arema.mx abre el evento correcto con /e/{id} (verificado con eventos reales).
  const link_boletos = `https://arema.mx/e/${ev.event_id}`;
  return {
    source: "arema" as const,
    source_id: String(ev.event_id),
    nombre,
    ciudad,
    venue: ev.venue_name?.trim() || null,
    fecha_inicio: fecha,
    fecha_fin: null as string | null,
    lineup: [] as string[], // sin line-up: approveCandidate sintetiza el artista desde el nombre (concierto de un acto)
    price_min: null,
    price_max: null,
    price_currency: null,
    link_boletos,
    // Solo se usa el póster si la API lo trae; no se arma ninguna URL a mano.
    image_url: ev.poster && ev.poster.startsWith("http") ? ev.poster : null,
    // La hora real vive aquí (event_candidates solo guarda fecha).
    raw_payload: { ...ev, hora_local: hora, zona_horaria: tz, fecha_local: fecha } as unknown as Record<string, unknown>,
    completo: Boolean(nombre && ciudad && fecha && link_boletos),
  };
}

type Dup = { id: string; nombre: string; ciudad: string | null; fecha_inicio: string | null };

// Mismo criterio que ticketmaster-sync / eticket-sync: nombre que se contiene
// mutuamente + fecha a ≤1 día + ciudad que se contiene mutuamente.
export function findPossibleDuplicate(
  event: { nombre: string; ciudad: string | null; fecha_inicio: string | null },
  others: Dup[],
): string | null {
  const normName = normalizeText(event.nombre);
  if (!normName) return null;
  for (const f of others) {
    const normOther = normalizeText(f.nombre);
    if (!normOther) continue;
    const namesMatch = normName === normOther || normName.includes(normOther) || normOther.includes(normName);
    if (!namesMatch) continue;
    if (event.fecha_inicio && f.fecha_inicio) {
      const diffDays = Math.abs(new Date(event.fecha_inicio).getTime() - new Date(f.fecha_inicio).getTime()) / 86_400_000;
      if (diffDays > 1) continue;
    }
    if (event.ciudad && f.ciudad) {
      const a = normalizeText(event.ciudad);
      const b = normalizeText(f.ciudad);
      if (!(a.includes(b) || b.includes(a))) continue;
    }
    return f.id;
  }
  return null;
}
