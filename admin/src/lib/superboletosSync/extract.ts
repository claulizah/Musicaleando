// Lógica pura de superboletos-sync (normalización + filtro de música +
// deduplicación) — sin ningún import de Playwright/navegador, para poder
// probarla con Node (ver tests/unit/superboletosSync.test.mts). runner.ts
// importa esto y le agrega la lectura real (navegar UNA vez y observar la
// respuesta que el propio sitio ya recibe — ver runner.ts para el porqué).

export type MusicCategoryLabel = 'Conciertos' | 'Festivales';
export const MUSIC_CATEGORIES: MusicCategoryLabel[] = ['Conciertos', 'Festivales'];

export type SuperboletosEvent = {
  eventoId: string;
  nombre: string;
  fecha_iso: string | null;
  fecha_texto: string | null;
  venue: string | null;
  ciudad: string;
  estado: string;
  link: string;
  price_min: number | null;
  price_max: number | null;
};

// Forma real del registro que trae catalogos/search.json (confirmada en
// vivo, no adivinada — ver el reporte del ticket). Se listan solo los
// campos que se usan; el JSON real trae más (imágenes, comisiones, etc.)
// que no hacen falta aquí.
export type RawSearchEntry = {
  eventoId: string;
  nombreEvento: string;
  nombreRecinto: string | null;
  nombreCiudad: string;
  nombreEstado: string;
  claveTipoEvento: string;
  claveEstatusFechaEvento: string;
  fechaPrimeraPresentacion: string; // "DD/MM/YYYY HH:MM:SS" o "" si no hay
  fechas: string; // texto para mostrar, ej. "25 de Octubre 18:00 Hrs."
  precioMinimo: string;
  precioMaximo: string;
};

// El nombre del evento en Superboletos viene TODO EN MAYÚSCULAS
// ("PEQUEÑOS MUSICAL", confirmado en vivo) — mismo criterio que
// eticket-sync: solo se re-castea a Title Case si la cadena original viene
// 100% en mayúsculas, nunca si ya trae mayúsculas y minúsculas mezcladas.
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

// "25/10/2026 18:30:00" -> "2026-10-25". Devuelve null si no viene (pasa en
// ~11% de los eventos NORMAL, visto en datos reales) o no se puede parsear
// — mejor un candidato con fecha vacía (Claudia la completa al aprobar,
// igual que hoy con un póster) que una fecha inventada.
export function parseFechaPrimeraPresentacion(raw: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return iso;
}

// Filtro de respaldo — visto en datos reales: 726 de 1181 eventos vienen
// marcados CANCELADO (se excluyen), y unos pocos claveTipoEvento son
// variantes espurias ("CONCIERTO" singular, 1 caso) que no son las dos
// etiquetas reales del sitio — se exige el valor exacto para no adivinar.
export function esMusicaVigente(e: RawSearchEntry): boolean {
  return (
    (e.claveTipoEvento === 'Conciertos' || e.claveTipoEvento === 'Festivales') &&
    e.claveEstatusFechaEvento === 'NORMAL'
  );
}

// Un evento marcado NORMAL pero con fecha ya pasada es un dato viejo mal
// etiquetado en la fuente (visto en datos reales: "MATUTE EN QUERETARO...",
// fecha "15 Marzo de 2025" con estatus NORMAL) — no debería llegar como
// candidato nuevo. Solo se descarta cuando SÍ hay fecha parseada y es
// pasada; sin fecha parseable no se puede saber, así que se deja pasar
// (Claudia lo revisa al aprobar).
export function esFechaFutura(fechaIso: string | null, hoy: string): boolean {
  return fechaIso === null || fechaIso >= hoy;
}

export function parseSearchEntry(e: RawSearchEntry): SuperboletosEvent {
  const fecha_iso = parseFechaPrimeraPresentacion(e.fechaPrimeraPresentacion);
  const min = Number(e.precioMinimo);
  const max = Number(e.precioMaximo);
  return {
    eventoId: e.eventoId,
    nombre: titleCaseIfShouting(e.nombreEvento),
    fecha_iso,
    fecha_texto: e.fechas?.trim() || null,
    venue: e.nombreRecinto ? titleCaseIfShouting(e.nombreRecinto) : null,
    ciudad: titleCaseIfShouting(e.nombreCiudad),
    estado: e.nombreEstado,
    link: `https://www.superboletos.com/landing-evento/${e.eventoId}`,
    price_min: min > 0 ? min : null,
    price_max: max > 0 ? max : null,
  };
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
// nombre normalizado que se contiene mutuamente + fecha dentro de 1 día
// (cuando ambas fechas existen) + ciudad que se contiene mutuamente cuando
// ambas existen.
export function findPossibleDuplicate(
  event: { nombre: string; ciudad: string; fecha_iso: string | null },
  festivals: { id: string; nombre: string; ciudad: string; fecha_inicio: string }[],
): string | null {
  const normName = normalizeText(event.nombre);
  for (const f of festivals) {
    const normFestName = normalizeText(f.nombre);
    const namesMatch = normName === normFestName || normName.includes(normFestName) || normFestName.includes(normName);
    if (!namesMatch) continue;
    if (event.fecha_iso) {
      const diffDays = Math.abs(new Date(event.fecha_iso).getTime() - new Date(f.fecha_inicio).getTime()) / 86_400_000;
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
