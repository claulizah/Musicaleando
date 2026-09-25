// Comparación de conjuntos de artistas (pura, sin dependencias) para la regla
// "un solo evento por artista, fecha y recinto" — ver variantFestival.ts.
export function sameIdSet(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 || sa.size !== sb.size) return false;
  for (const id of sa) if (!sb.has(id)) return false;
  return true;
}
