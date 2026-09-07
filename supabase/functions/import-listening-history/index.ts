import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Import opcional de Spotify/Apple Music: the client parses the exported
// history file locally and sends only a short list of {name, plays} for the
// user's most-played artists (never the raw export — some Spotify Extended
// Streaming History exports run into tens of MB across many files).
//
// This function maps those artist names onto our 8 internal genre buckets.
// The obvious approach — look up each artist and read its `genres` field —
// does NOT work on this app's Spotify access tier: as of Nov 2024 Spotify
// gates `genres`/`popularity`/`followers` off the Artist object behind
// "extended quota mode", confirmed empirically (curl against both
// /v1/search and /v1/artists/{id} for well-known artists like Bad Bunny
// returns no `genres` key at all, app-registered-after-cutoff apps don't
// get it). What still works: genre-filtered Search (`q=genre:"X"`), the
// same call spotify-artists uses for Torneo Sonoro. So instead of asking
// Spotify "what genre is this artist", we build a reverse index — fetch
// each of our 8 genres' top artists and remember which genre surfaced
// them — then match the user's imported artist names against that index.
// Real Spotify data, no fabricated mapping, just used in the direction
// Spotify actually allows.

const SPOTIFY_CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET");

const GENRE_SEARCH_TERM: Record<string, string> = {
  rock: "rock",
  electronica: "electronic",
  pop: "pop",
  latin: "latin",
  indie: "indie",
  lofi: "lo-fi",
  jazz: "jazz",
  metal: "metal",
};

const MAX_ARTISTS = 30;
const MAX_GENEROS_RETURNED = 3;

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5_000) {
    return cachedToken.value;
  }
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET secrets.");
  }

  const basic = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

async function searchArtistNamesByGenre(term: string, token: string): Promise<string[]> {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", `genre:"${term}"`);
  url.searchParams.set("type", "artist");
  // Same tier cap discovered building Torneo Sonoro: >10 returns 400 "Invalid limit".
  url.searchParams.set("limit", "10");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error(`Spotify search failed for genre "${term}": ${res.status} ${await res.text()}`);
    return [];
  }

  const data = (await res.json()) as { artists: { items: { name: string }[] } };
  return (data.artists?.items ?? []).map((a) => a.name).filter(Boolean);
}

async function buildGenreIndex(token: string): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const perGenre = await Promise.all(
    Object.entries(GENRE_SEARCH_TERM).map(async ([generoId, term]) => ({
      generoId,
      names: await searchArtistNamesByGenre(term, token),
    })),
  );
  for (const { generoId, names } of perGenre) {
    for (const name of names) {
      const key = name.trim().toLowerCase();
      if (!index.has(key)) index.set(key, generoId);
    }
  }
  return index;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const artists: { name: string; plays: number }[] = Array.isArray(body.artists) ? body.artists : [];

    if (artists.length === 0) {
      return new Response(JSON.stringify({ error: "No se recibieron artistas para procesar." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = await getAccessToken();
    const sample = artists
      .filter((a) => typeof a.name === "string" && a.name.trim().length > 0)
      .slice(0, MAX_ARTISTS);

    const index = await buildGenreIndex(token);

    const scores: Record<string, number> = {};
    const matchedArtists: { name: string; generoId: string }[] = [];
    let unmatchedCount = 0;

    for (const artist of sample) {
      const generoId = index.get(artist.name.trim().toLowerCase());
      if (!generoId) {
        unmatchedCount++;
        continue;
      }
      matchedArtists.push({ name: artist.name, generoId });
      scores[generoId] = (scores[generoId] ?? 0) + artist.plays;
    }

    const generos = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_GENEROS_RETURNED)
      .map(([bucket]) => bucket);

    return new Response(
      JSON.stringify({ generos, matchedArtists, unmatchedCount, totalSubmitted: sample.length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
