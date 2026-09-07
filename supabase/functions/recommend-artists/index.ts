import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Recomendaciones V1 (motor propio), per spec: "Similitud tipo coseno entre
// el vector de gustos del usuario (géneros, energía, arquetipo, campeón del
// Torneo Sonoro) y la metadata pública de artistas (género, popularidad vía
// Search/Get Artist)."
//
// A literal multi-dimensional cosine similarity isn't possible with real
// data here: Spotify's Search and Get Artist endpoints don't return
// `genres` or `popularity` on this app's access tier (confirmed building
// Torneo Sonoro/import — same Nov 2024 "extended quota mode" restriction).
// So V1 is an honest, simpler proxy that still uses the signals the spec
// names, just scored instead of vector-compared:
//   - genre overlap: candidate artists come from genre-filtered Search
//     across the user's own `generos` (same reverse-index technique as
//     Torneo Sonoro/import), so every candidate already matches at least
//     one of the user's genres.
//   - Torneo Sonoro champion: candidates whose source genre matches the
//     champion's genre get a score boost — closest available proxy to
//     "similar to what you already crowned", since a real Related Artists
//     call is also blocked at this tier.
//   - `energia`/`arquetipo` aren't used to score individual artists (no
//     per-artist energy data exists anywhere reachable), but the caller can
//     still use them for copy/framing — noted here so this isn't silently
//     dropped.

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

const DEFAULT_LIMIT = 6;

type SpotifyArtist = {
  id: string;
  name: string;
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
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

async function searchArtistsByGenre(term: string, token: string): Promise<SpotifyArtist[]> {
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", `genre:"${term}"`);
  url.searchParams.set("type", "artist");
  url.searchParams.set("limit", "10"); // tier cap discovered building Torneo Sonoro

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error(`Spotify search failed for genre "${term}": ${res.status} ${await res.text()}`);
    return [];
  }

  const data = (await res.json()) as { artists: { items: SpotifyArtist[] } };
  return (data.artists?.items ?? []).filter((a) => a.name && a.images?.length > 0);
}

function pickImage(artist: SpotifyArtist): string | undefined {
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
    const championGenreId: string | undefined =
      typeof body.championGenreId === "string" ? body.championGenreId : undefined;
    const excludeArtistIds: Set<string> = new Set(
      Array.isArray(body.excludeArtistIds) ? body.excludeArtistIds : [],
    );
    const limit = Number.isInteger(body.limit) && body.limit > 0 ? body.limit : DEFAULT_LIMIT;

    const pairs = generos
      .map((generoId) => ({ generoId, term: GENRE_SEARCH_TERM[generoId] }))
      .filter((p): p is { generoId: string; term: string } => Boolean(p.term));

    if (pairs.length === 0) {
      return new Response(JSON.stringify({ artists: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = await getAccessToken();
    const perGenre = await Promise.all(
      pairs.map(async ({ generoId, term }) => ({
        generoId,
        artists: await searchArtistsByGenre(term, token),
      })),
    );

    type Scored = { artist: SpotifyArtist; generoId: string; score: number };
    const seen = new Set<string>();
    const scored: Scored[] = [];

    for (const { generoId, artists } of perGenre) {
      for (const artist of artists) {
        if (seen.has(artist.id) || excludeArtistIds.has(artist.id)) continue;
        seen.add(artist.id);
        const score = generoId === championGenreId ? 2 : 1;
        scored.push({ artist, generoId, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const artists = scored.slice(0, limit).map(({ artist, generoId, score }) => ({
      id: artist.id,
      name: artist.name,
      imageUrl: pickImage(artist),
      generoId,
      matchedChampion: score > 1,
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
