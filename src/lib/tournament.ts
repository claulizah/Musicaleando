// Torneo Sonoro: single-elimination bracket over 8 real artists (name +
// image from Spotify), chosen from the user's favorite genres — per spec,
// "Bracket de eliminación con 8 artistas elegidos según los géneros de la
// Fase 1: cuartos → semifinal → gran final". Distinct from the quiz's
// "duelo_visual"/"duelo_final" steps, which are single flavor-only
// questions, not a bracket.

export const TOURNAMENT_SIZE = 8;
export const TOURNAMENT_DUEL_COUNT = TOURNAMENT_SIZE - 1; // 7 duels total

export function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function roundLabel(roundIndex: number): string {
  const remaining = TOURNAMENT_SIZE / 2 ** roundIndex;
  if (remaining === 2) return 'Gran final';
  if (remaining === 4) return 'Semifinal';
  return `Ronda de ${remaining}`;
}
