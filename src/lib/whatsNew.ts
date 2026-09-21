export type Novedad = {
  id: string;
  pantalla: string;
  titulo: string;
  cuerpo: string;
  publicada_en: string;
  vigente_hasta: string | null;
  activa: boolean;
};

// Qué aviso de "Nuevo" toca mostrar en una pantalla: uno solo a la vez (para
// no apilar), el más reciente que esté activo, ya publicado, sin vencer, de
// esa pantalla y que el usuario todavía no haya cerrado. Sin efectos
// secundarios a propósito — es la regla que se prueba automáticamente.
export function pickPendingNews(
  all: Novedad[],
  seenIds: Iterable<string>,
  pantalla: string,
  now: Date = new Date(),
): Novedad | null {
  const seen = new Set(seenIds);
  const t = now.getTime();
  const candidates = all.filter(
    (n) =>
      n.activa &&
      n.pantalla === pantalla &&
      !seen.has(n.id) &&
      new Date(n.publicada_en).getTime() <= t &&
      (n.vigente_hasta === null || new Date(n.vigente_hasta).getTime() > t),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (new Date(b.publicada_en).getTime() > new Date(a.publicada_en).getTime() ? b : a));
}
