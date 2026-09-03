import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Torneo Sonoro needs 8 real artists (name + image) drawn from the user's
// favorite genres, per spec: "Bracket de eliminación con 8 artistas elegidos
// según los géneros de la Fase 1". Uses Spotify's Client Credentials flow
// (app-only auth, no end-user Spotify login) and the Search endpoint — Search
// stays open to all apps even after Spotify's Nov 2024 API restrictions,
// unlike Recommendations/Related Artists which now require extended access.

const SPOTIFY_CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID");
const SPOTIFY_CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET");

// Internal quiz genre id -> Spotify search genre term. Spotify's own genre
// tagging is inconsistent/informal, so these are best-effort matches, not a
// guaranteed taxonomy.
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

const TARGET_ARTIST_COUNT = 8;
const FALLBACK_GENRE_TERM = "pop";

type SpotifyArtist = {
  id: string;
  name: string;
  popularity: number;
  images: { url: string; width: number; height: number }[];
};

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
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

async function searchArtistsByGenre(term: string, token: string): Promise<SpotifyArtist[]> {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", `genre:"${term}"`);
  url.searchParams.set("type", "artist");
  // Empirically this app's Spotify access tier caps Search's `limit` at 10 —
  // values above that (even within the documented 1-50 range) return a 400
  // "Invalid limit" error.
  url.searchParams.set("limit", "10");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.error(`Spotify search failed for genre "${term}": ${res.status} ${await res.text()}`);
    return [];
  }

  const data = (await res.json()) as { artists: { items: SpotifyArtist[] } };
  return (data.artists?.items ?? []).filter((a) => a.name && a.images?.length > 0);
}

type TaggedArtist = SpotifyArtist & { generoId: string };

function pickImage(artist: SpotifyArtist): string | undefined {
  // images[] is typically ordered largest-first (640 / 300 / 64). A mid-size
  // image is plenty for a bracket tile and keeps payloads small.
  const sorted = [...artist.images].sort((a, b) => a.width - b.width);
  return (sorted.find((img) => img.width >= 300) ?? sorted[sorted.length - 1])?.url;
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
    const generos: string[] = Array.isArray(body.generos) ? body.generos : [];

    // Pair each requested genre with its Spotify search term, so results can
    // be tagged back to the internal genre id (needed by the app to know
    // which genre to reinforce in music_profile.generos when a champion is
    // crowned — that's what re-triggers the compat_score recompute trigger).
    const pairs = generos
      .map((generoId) => ({ generoId, term: GENRE_SEARCH_TERM[generoId] }))
      .filter((p): p is { generoId: string; term: string } => Boolean(p.term));
    const searchPairs =
      pairs.length > 0 ? pairs : [{ generoId: FALLBACK_GENRE_TERM, term: FALLBACK_GENRE_TERM }];

    const token = await getAccessToken();
    const perGenre = await Promise.all(
      searchPairs.map(async ({ generoId, term }) => {
        const list = await searchArtistsByGenre(term, token);
        return list.map((a): TaggedArtist => ({ ...a, generoId }));
      }),
    );

    // Round-robin across genres so no single genre dominates the bracket,
    // sorting each genre's pool by popularity first.
    const sortedPools = perGenre.map((list) =>
      [...list].sort((a, b) => b.popularity - a.popularity),
    );
    const seen = new Set<string>();
    const picked: TaggedArtist[] = [];
    let round = 0;
    while (picked.length < TARGET_ARTIST_COUNT && sortedPools.some((p) => p.length > round)) {
      for (const pool of sortedPools) {
        if (picked.length >= TARGET_ARTIST_COUNT) break;
        const candidate = pool[round];
        if (candidate && !seen.has(candidate.id)) {
          seen.add(candidate.id);
          picked.push(candidate);
        }
      }
      round++;
    }

    // Backfill from a broad fallback genre if the user's genres didn't yield enough.
    if (picked.length < TARGET_ARTIST_COUNT) {
      const fallbackList = await searchArtistsByGenre(FALLBACK_GENRE_TERM, token);
      const fallbackPool = fallbackList
        .map((a): TaggedArtist => ({ ...a, generoId: FALLBACK_GENRE_TERM }))
        .sort((a, b) => b.popularity - a.popularity);
      for (const candidate of fallbackPool) {
        if (picked.length >= TARGET_ARTIST_COUNT) break;
        if (!seen.has(candidate.id)) {
          seen.add(candidate.id);
          picked.push(candidate);
        }
      }
    }

    if (picked.length < TARGET_ARTIST_COUNT) {
      return new Response(
        JSON.stringify({ error: `Only found ${picked.length} artists, need ${TARGET_ARTIST_COUNT}.` }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const artists = picked.slice(0, TARGET_ARTIST_COUNT).map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: pickImage(a),
      generoId: a.generoId,
    }));

    return new Response(JSON.stringify({ artists }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
