import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// "Festival generado por tus gustos" (Sprint 4) — no dedicated spec section
// (unlike Torneo Sonoro's "Fase 2"), read as applying the V1 recommendation
// signal to one festival's real line-up instead of discovering new artists:
// given the user's genres and a festival's actual lineup (real artist names
// from festival_lineup, loaded via the admin CSV importer), highlight which
// lineup artists match the user's taste.
//
// Same reverse-index technique as import-listening-history: build a
// (lowercased artist name -> internal genre id) index from genre-filtered
// Search across the user's genres, then match lineup names against it.
// Exact-name matching only — no fuzzy matching, so a lineup artist not in
// the sampled search pool for a matching genre won't show as a match even
// if they genuinely fit that genre. That's a real recall limitation, not a
// bug: the same one already documented for the import feature.

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
  url.searchParams.set("limit", "10");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error(`Spotify search failed for genre "${term}": ${res.status} ${await res.text()}`);
    return [];
  }

  const data = (await res.json()) as { artists: { items: { name: string }[] } };
  return (data.artists?.items ?? []).map((a) => a.name).filter(Boolean);
}

async function buildGenreIndex(generos: string[], token: string): Promise<Map<string, string>> {
  const pairs = generos
    .map((generoId) => ({ generoId, term: GENRE_SEARCH_TERM[generoId] }))
    .filter((p): p is { generoId: string; term: string } => Boolean(p.term));

  const index = new Map<string, string>();
  const perGenre = await Promise.all(
    pairs.map(async ({ generoId, term }) => ({
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
    const generos: string[] = Array.isArray(body.generos) ? body.generos : [];
    const lineup: string[] = Array.isArray(body.lineup)
      ? body.lineup.filter((n: unknown) => typeof n === "string")
      : [];

    if (generos.length === 0 || lineup.length === 0) {
      return new Response(JSON.stringify({ matches: [], totalLineup: lineup.length }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = await getAccessToken();
    const index = await buildGenreIndex(generos, token);

    const matches = lineup
      .map((artista) => ({ artista, generoId: index.get(artista.trim().toLowerCase()) }))
      .filter((m): m is { artista: string; generoId: string } => Boolean(m.generoId));

    return new Response(JSON.stringify({ matches, totalLineup: lineup.length }), {
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
