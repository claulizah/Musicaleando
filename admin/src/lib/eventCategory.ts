// Categorías más granulares que festival/concierto — derivadas, no
// guardadas (mismo criterio que mexicoEstados.ts: se recalculan al mostrar,
// no requieren migración ni backfill). Ninguna fuente (Ticketmaster, imagen,
// link) trae esta clasificación explícita, así que se infiere con una
// heurística validada contra los datos reales de producción (756
// festivales aprobados al momento de escribir esto):
//
//   gira_tour        83  — nombre contiene "tour" (ej. "Young Miko - Late
//                          Checkout Tour", "wave to earth - the pieces
//                          tour") — señal fuerte y muy común en los datos
//                          reales, se revisa ANTES que festival/concierto
//                          porque una gira puede venir etiquetada como
//                          cualquiera de los dos tipos.
//   especial         13  — nombre sugiere aniversario o evento fuera de lo
//                          normal ("Bengala 20 Años", "CIRQUE DU SOLEIL -
//                          ECHO - GNP EXPERIENCE").
//   festival_multidia 11 — tipo festival con fecha_inicio != fecha_fin
//                          (Corona Capital 2026, Time Warp).
//   festival_un_dia  582 — tipo festival, un solo día — la mayoría del
//                          catálogo hoy.
//   concierto_unico   56 — tipo concierto (ya es un concepto de "un solo
//                          acto" por diseño de este mismo sistema).
//   sin_categoria       — tipo todavía sin confirmar (null).
export type EventCategory =
  | 'gira_tour'
  | 'especial'
  | 'festival_multidia'
  | 'festival_un_dia'
  | 'concierto_unico'
  | 'sin_categoria';

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  gira_tour: '🚌 Gira/Tour',
  especial: '✨ Especial',
  festival_multidia: '🎪 Festival multi-día',
  festival_un_dia: '🎪 Festival (1 día)',
  concierto_unico: '🎤 Concierto único',
  sin_categoria: '❓ Sin categoría',
};

const TOUR_RE = /\btour\b/i;
const SPECIAL_RE = /a[ñn]os|aniversario|experience|showcase|especial/i;

export function categorizeEvent(event: {
  nombre: string;
  tipo: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}): EventCategory {
  if (TOUR_RE.test(event.nombre)) return 'gira_tour';
  if (SPECIAL_RE.test(event.nombre)) return 'especial';
  if (event.tipo === 'festival') {
    return event.fecha_inicio && event.fecha_fin && event.fecha_inicio !== event.fecha_fin
      ? 'festival_multidia'
      : 'festival_un_dia';
  }
  if (event.tipo === 'concierto') return 'concierto_unico';
  return 'sin_categoria';
}
