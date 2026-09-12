import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Admin-only: pulls Last.fm's tag.getTopTracks (public, no user OAuth — same
// kind of app-only access as Spotify Client Credentials) as *candidates* for
// a mood-actividad playlist. Nothing is written here — this only returns
// tracks; the admin panel's server action does the actual insert into
// mood_playlists (estado='pendiente'), same "nothing publishes without
// curator approval" pattern used elsewhere in this project.

const LASTFM_API_KEY = Deno.env.get("LASTFM_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "No autorizado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Forward the caller's own JWT so RLS applies naturally when reading
    // `users` — this function only proceeds if the caller is is_admin.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "No autorizado." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: "Solo administradores." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!LASTFM_API_KEY) {
      return new Response(JSON.stringify({ error: "Falta el secreto LASTFM_API_KEY." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tag = typeof body.tag === "string" ? body.tag.trim() : "";
    const limit = Number.isFinite(body.limit) ? Math.min(Math.max(Number(body.limit), 1), 30) : 10;
    if (!tag) {
      return new Response(JSON.stringify({ error: "Falta el tag de Last.fm." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "tag.gettoptracks");
    url.searchParams.set("tag", tag);
    url.searchParams.set("api_key", LASTFM_API_KEY);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error(`Last.fm tag.getTopTracks failed for "${tag}": ${res.status} ${text}`);
      return new Response(JSON.stringify({ error: `Last.fm respondió ${res.status}.` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = (await res.json()) as {
      tracks?: { track?: { name?: string; artist?: { name?: string } }[] };
      message?: string;
    };

    if (data.message) {
      // Last.fm returns 200 with an error payload for some failures (e.g. suspended key).
      return new Response(JSON.stringify({ error: data.message }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tracks = (data.tracks?.track ?? [])
      .map((t) => ({ titulo: t.name ?? "", artista: t.artist?.name ?? "" }))
      .filter((t) => t.titulo && t.artista);

    return new Response(JSON.stringify({ tracks }), {
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
