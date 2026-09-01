// Mirrors the SQL cosine-similarity logic (public.music_vector /
// public.cosine_similarity) so the app can compute a "compatibilidad
// contigo" score per squad member on the client, without a DB round trip.
// The stored squad_members.compat_score is a different number: each
// member's average similarity to the REST of the squad (trigger-maintained).

const GENRE_ORDER = ['rock', 'electronica', 'pop', 'latin', 'indie', 'lofi', 'jazz', 'metal'] as const;

export function musicVector(generos: string[], energia: number): number[] {
  return [...GENRE_ORDER.map((g) => (generos.includes(g) ? 1 : 0)), energia ?? 0.5];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  if (normA === 0 || normB === 0) return 0;
  return Math.max(0, Math.min(1, dot / (normA * normB)));
}

export function compatScore(
  a: { generos: string[]; energia: number },
  b: { generos: string[]; energia: number },
): number {
  return Math.round(cosineSimilarity(musicVector(a.generos, a.energia), musicVector(b.generos, b.energia)) * 100);
}
