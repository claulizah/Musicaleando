// Torneo Sonoro: single-elimination bracket over the 8 GENEROS. Purely a
// standalone, replayable feature — distinct from the quiz's "duelo_visual"/
// "duelo_final" steps, which are single flavor-only questions, not a bracket.
import { GENEROS } from './archetypes';

export const TOURNAMENT_ROUNDS = Math.log2(GENEROS.length); // 3 rounds for 8 items
export const TOURNAMENT_DUEL_COUNT = GENEROS.length - 1; // 7 duels total

export function shuffledGeneroIds(): string[] {
  const ids = GENEROS.map((g) => g.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function roundLabel(roundIndex: number): string {
  const remaining = GENEROS.length / 2 ** roundIndex;
  if (remaining === 2) return 'Gran final';
  if (remaining === 4) return 'Semifinal';
  return `Ronda de ${remaining}`;
}
