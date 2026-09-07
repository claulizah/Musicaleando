// Weekly challenge: a lightweight recurring reason to come back, deliberately
// with no points economy behind it — just a challenge + a progress bar.
// Computed entirely from data the app already has (festival_intent,
// community_share_votes, community_shares), no new table needed.

export type WeeklyChallenge = {
  id: 'primer_festival' | 'votar_trends' | 'compartir_cancion';
  label: string;
  description: string;
  emoji: string;
  target: number;
  progress: number;
};

// ISO-ish week number (good enough for rotating a challenge, not for
// calendar-accurate reporting).
function weekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}

export function currentWeeklyChallenge(input: {
  festivalesConfirmadosTotal: number;
  votesThisWeek: number;
  sharesThisWeek: number;
  now?: Date;
}): WeeklyChallenge {
  const { festivalesConfirmadosTotal, votesThisWeek, sharesThisWeek } = input;
  const now = input.now ?? new Date();

  // A user with zero confirmed festivals ever gets the highest-value nudge,
  // regardless of week rotation — converting that first "Voy" matters more
  // than which of the recurring challenges would otherwise be up.
  if (festivalesConfirmadosTotal === 0) {
    return {
      id: 'primer_festival',
      label: 'Confirma tu primer festival',
      description: 'Marca "Voy" en cualquier festival del Hub.',
      emoji: '🎪',
      target: 1,
      progress: 0,
    };
  }

  const rotation = weekNumber(now) % 2;
  if (rotation === 0) {
    return {
      id: 'votar_trends',
      label: 'Vota en 3 trends esta semana',
      description: 'Dale like a canciones o playlists en Trends comunitarios.',
      emoji: '📈',
      target: 3,
      progress: Math.min(votesThisWeek, 3),
    };
  }

  return {
    id: 'compartir_cancion',
    label: 'Comparte una canción esta semana',
    description: 'Comparte una canción o playlist en Trends comunitarios.',
    emoji: '🎵',
    target: 1,
    progress: Math.min(sharesThisWeek, 1),
  };
}

export function startOfWeekIso(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
