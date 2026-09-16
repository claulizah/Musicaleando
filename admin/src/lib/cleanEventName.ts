// Limpieza de nombres de evento — deliberadamente conservadora. Ver
// prompt-siguiente-normalizar-nombres-bulk-aprobar.md: nombres artísticos
// reales vienen en mayúsculas a propósito (SIDDHARTHA, LAGOS, CAMPIRINO), así
// que esto NUNCA re-castea mayúsculas/minúsculas ni intenta separar
// ciudad/año/gira del nombre — solo colapsa espacios, quita comillas que
// envuelven el nombre COMPLETO, y colapsa guiones repetidos. Todo lo demás
// (comilla suelta en un solo extremo, "en CIUDAD" pegado, aniversarios
// pegados) se reporta para revisión humana, nunca se aplica solo.

const QUOTE_PAIRS: [string, string][] = [
  ["'", "'"],
  ['"', '"'],
  ['‘', '’'], // ' '
  ['“', '”'], // " "
];

// Solo quita el par si envuelve el nombre COMPLETO (mismo criterio en ambos
// extremos) — eso es casi siempre un artefacto de extracción, nunca una
// elección de estilo real. Una comilla suelta en un solo extremo se deja
// intacta a propósito (podría ser parte real del título).
function stripWrappingQuotes(s: string): string {
  for (const [open, close] of QUOTE_PAIRS) {
    if (s.length > open.length + close.length && s.startsWith(open) && s.endsWith(close)) {
      const inner = s.slice(open.length, s.length - close.length).trim();
      if (inner.length > 0) return inner;
    }
  }
  return s;
}

export function cleanEventNameSafe(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ');
  s = s.replace(/-{2,}/g, '-');
  s = stripWrappingQuotes(s).trim().replace(/\s+/g, ' ');
  return s;
}

// Una comilla en un solo extremo (no en ambos) — ej. "Heavy Nopal 'Tributo a
// Rockdrigo González'" no empieza con comilla pero sí termina en una. No se
// sabe si es parte real del título o un artefacto de extracción a medias,
// así que se reporta en vez de tocarse.
export function hasDanglingQuote(raw: string): boolean {
  const s = raw.trim();
  const startsWithQuote = /^['"‘“]/.test(s);
  const endsWithQuote = /['"’”]$/.test(s);
  return startsWithQuote !== endsWithQuote;
}

// Heurísticas de "info pegada al nombre" — solo para reportar cuántos casos
// hay (candidato a un ticket futuro de separación ciudad/año/gira), nunca
// para arreglar automáticamente.
export function hasGluedCitySuffix(raw: string): boolean {
  return /\ben\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.]*(\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.]*)*$/.test(raw.trim());
}

export function hasGluedAnniversarySuffix(raw: string): boolean {
  return /\b\d{1,3}\s*(años|aniversario|aniversarios)\b/i.test(raw);
}
