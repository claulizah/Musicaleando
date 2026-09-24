// Cuando un evento no trae line-up (típico de Arema: "Anabanta en Aguascalientes"),
// approveCandidate sintetiza el artista con el nombre del evento. Antes se
// quedaba con la ciudad pegada; esto la quita SOLO cuando lo que sigue a " en "
// corresponde de verdad a un lugar del propio evento — nunca adivina.

function norm(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Abreviaturas de Ciudad de México que Arema usa en los nombres.
const ALIAS: Record<string, string> = { cdmx: 'ciudad de mexico', 'cd mx': 'ciudad de mexico', df: 'ciudad de mexico', 'd f': 'ciudad de mexico' };

export type EventPlace = {
  ciudad?: string | null; // ciudad del evento
  estado?: string | null; // venues.state
  venue?: string | null; // nombre del foro
};

// Quita " en <Lugar>" (con año opcional al final, ej. "en Toluca 2026") si <Lugar>
// coincide (sin acentos/mayúsculas; el lugar del evento puede ser más largo que lo
// escrito, ej. "Querétaro" ~ "Santiago de Querétaro", pero NO al revés) con la
// ciudad, el estado o el foro del evento, o con una abreviatura de CDMX. Se usa
// la primera aparición de " en " cuya cola coincide, para no cortar títulos que
// contengan " en " ("Amor en Tiempos de Guerra en Puebla" -> "Amor en Tiempos de Guerra").
// Si no hay ningún dato del lugar, o nada coincide, o quedaría vacío: devuelve el
// nombre tal cual.
export function stripCitySuffix(name: string, place: EventPlace): string {
  const s = name.trim().replace(/\s+/g, ' ');
  const targets = [place.ciudad, place.estado, place.venue].map(norm).filter((t) => t.length >= 3);
  if (targets.length === 0) return name;

  for (const m of s.matchAll(/\s+en\s+/gi)) {
    const rawTail = s.slice((m.index ?? 0) + m[0].length).replace(/\s+(?:19|20)\d{2}\s*$/, '');
    let tail = norm(rawTail);
    if (tail.length < 3) continue;
    tail = ALIAS[tail] ?? tail;
    if (targets.some((t) => t === tail || t.includes(tail))) {
      const head = s.slice(0, m.index).trim();
      return head.length >= 2 ? head : name;
    }
  }
  return name;
}
