// Lógica pura de superboletos-sync (normalización + filtro de música +
// deduplicación) — sin ningún import de Playwright/navegador, para poder
// probarla con Node (ver tests/unit/superboletosSync.test.mts). runner.ts
// importa esto y le agrega la lectura real del DOM (verificada en vivo, ver
// el reporte del ticket para los selectores confirmados).

export type MusicCategoryLabel = 'Conciertos' | 'Festivales';
export const MUSIC_CATEGORIES: MusicCategoryLabel[] = ['Conciertos', 'Festivales'];

export type SuperboletosEvent = {
  nombre: string;
  fecha_texto: string | null;
  venue: string | null;
  ciudad: string;
  estado: string;
  link: string | null;
};

// El nombre del evento en Superboletos viene TODO EN MAYÚSCULAS en la
// tarjeta ("PEQUEÑOS MUSICAL", "ALAN PARSONS THE SHOW MUST GO ON",
// confirmado en vivo) — mismo criterio que eticket-sync (ver
// supabase/functions/eticket-sync/normalize.ts): solo se re-castea a Title
// Case si la cadena original viene 100% en mayúsculas, nunca si ya trae
// mayúsculas y minúsculas mezcladas (podría ser una estilización real).
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'con', 'a', 'al', 'un', 'una']);
export function titleCaseIfShouting(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s || s !== s.toUpperCase() || s === s.toLowerCase()) return s;
  return s
    .toLowerCase()
    .split(' ')
    .map((word, i) => (i > 0 && CONECTORES.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

// La tarjeta trae la ubicación como un solo texto "Ciudad, Estado"
// (confirmado en vivo: "Querétaro, Querétaro", "Ciudad de México, Ciudad de
// México"). Sin coma, se usa el mismo texto para ambos — mejor un estado
// igual a la ciudad que perder el dato.
export function parseCityState(raw: string): { ciudad: string; estado: string } {
  const s = raw.trim();
  const i = s.indexOf(',');
  if (i < 0) return { ciudad: s, estado: s };
  return { ciudad: s.slice(0, i).trim(), estado: s.slice(i + 1).trim() };
}

// Filtro de respaldo por si algún evento de otra categoría se cuela en la
// lectura de "Conciertos"/"Festivales" — visto en la investigación en vivo:
// "TRADICIONAL CORRIDA FIESTAS PATRIAS" (toros) apareció en la lista sin
// filtrar; tras hacer clic en la pestaña "Conciertos" ya no salía, pero este
// filtro queda como segunda capa. Deliberadamente conservador: solo
// descarta lo que reconoce con certeza.
const NO_MUSICA = /\b(globetrotters|circo|f[uú]tbol|beisbol|béisbol|lucha libre|box(eo)?|rodeo|toros|charrer[ií]a|corrida)\b/i;
export function pareceMusica(nombre: string): boolean {
  return !NO_MUSICA.test(nombre);
}

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Mismo criterio de "posible duplicado" que ticketmaster-sync/eticket-sync:
// nombre normalizado que se contiene mutuamente + ciudad que se contiene
// mutuamente cuando ambas existen. Sin fecha ISO real (fecha_texto es texto
// libre, ej. "09 de Octubre 20:00 Hrs.", sin año en varios casos vistos en
// vivo) no se puede exigir "misma fecha ±1 día" como en las otras fuentes —
// se compara solo por nombre+ciudad, así que puede marcar como duplicado un
// re-anuncio del mismo artista en la misma ciudad en otra fecha; es
// intencionalmente conservador (mejor un falso "ya existe" que Claudia
// revisa, que un duplicado real que se cuela).
export function findPossibleDuplicate(
  event: { nombre: string; ciudad: string },
  festivals: { id: string; nombre: string; ciudad: string }[],
): string | null {
  const normName = normalizeText(event.nombre);
  for (const f of festivals) {
    const normFestName = normalizeText(f.nombre);
    const namesMatch = normName === normFestName || normName.includes(normFestName) || normFestName.includes(normName);
    if (!namesMatch) continue;
    const ciudadesMatch =
      normalizeText(event.ciudad).includes(normalizeText(f.ciudad)) ||
      normalizeText(f.ciudad).includes(normalizeText(event.ciudad));
    if (!ciudadesMatch) continue;
    return f.id;
  }
  return null;
}
