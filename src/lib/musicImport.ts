import { supabase } from './supabase';

// Lenient parser for a Spotify "Extended Streaming History" export (or the
// equivalent Apple Music export) — tries several known key names per entry
// so it tolerates the couple of real Spotify export shapes as well as a
// reasonable guess at Apple Music's. Never throws: an unrecognized/corrupt/
// empty file just returns null, and the caller falls back gracefully (the
// quiz-based profile stays valid either way).

export type ParsedListeningHistory = {
  artistCounts: Map<string, number>;
  totalEntries: number;
  recognizedEntries: number;
};

function extractArtistName(entry: Record<string, unknown>): string | null {
  const candidates = [
    entry.master_metadata_album_artist_name, // Spotify Extended Streaming History
    entry.artistName, // Spotify StreamingHistory_music_*.json (older export)
    entry.artist,
    entry.Artist,
    entry['Artist Name'],
    entry['Container Artist Name'], // Apple Music Library Tracks.json
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  // Apple Music "Play Activity"-style exports sometimes only have a combined
  // "Artist - Track" description field.
  const description = entry['Track Description'];
  if (typeof description === 'string' && description.includes(' - ')) {
    const artist = description.split(' - ')[0]?.trim();
    if (artist) return artist;
  }
  return null;
}

export function parseListeningHistory(raw: string): ParsedListeningHistory | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const entries: unknown[] | null = Array.isArray(json)
    ? json
    : Array.isArray((json as { items?: unknown })?.items)
      ? (json as { items: unknown[] }).items
      : null;

  if (!entries || entries.length === 0) return null;

  const artistCounts = new Map<string, number>();
  let recognizedEntries = 0;

  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const name = extractArtistName(entry as Record<string, unknown>);
    if (!name) continue;
    recognizedEntries++;
    artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1);
  }

  // Parsed as JSON fine, but nothing looked like a listening-history entry —
  // treat as an unrecognized/unsupported format, not a silent empty import.
  if (recognizedEntries === 0) return null;

  return { artistCounts, totalEntries: entries.length, recognizedEntries };
}

export function topArtists(
  parsed: ParsedListeningHistory,
  limit = 30,
): { name: string; plays: number }[] {
  return [...parsed.artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, plays]) => ({ name, plays }));
}

export type ImportGenreResult = {
  generos: string[];
  matchedArtists: { name: string; generoId: string }[];
  unmatchedCount: number;
  totalSubmitted: number;
};

export async function fetchImportGenres(
  artists: { name: string; plays: number }[],
): Promise<ImportGenreResult> {
  const { data, error } = await supabase.functions.invoke<ImportGenreResult & { error?: string }>(
    'import-listening-history',
    { body: { artists } },
  );
  if (error) throw error;
  if (!data || !Array.isArray(data.generos)) {
    throw new Error(data?.error ?? 'No se pudo procesar tu historial.');
  }
  return data;
}
