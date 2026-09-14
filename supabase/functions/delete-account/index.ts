import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Permanently deletes the calling user's own account. The client can never
// be trusted with this: it has no service role key, and Apple/Google both
// require in-app account deletion (not just "email us"), so this must be a
// real self-serve endpoint, not an admin tool.
//
// Auth model note: Musicaleando has no email/password — every device signs
// in anonymously (see src/lib/supabase.ts ensureSession) and auth.uid() is
// the only identity. This function trusts ONLY the caller's own verified
// JWT (via supabase.auth.getUser() below), never an id from the request
// body, so a user can never delete anyone but themselves.
//
// STATUS: auth check is real; the actual deletion is not implemented yet.
// It's pending a live inspection of the ijwyykfuyeaahvxmaild project's real
// FK delete rules (CASCADE/RESTRICT/SET NULL) before writing table-by-table
// DELETE/UPDATE statements — guessing here risks either an existing cascade
// silently wiping content that should be anonymized instead, or leaving
// orphaned rows behind. Until that inspection happens, this returns 501 so
// the client's error handling can be built and tested against a real
// endpoint shape.
//
// Planned data handling (from product decisions already made — see
// ESTADO.md/conversation history once this lands there):
//   - Anonymize (reassign to a sentinel "usuario eliminado" users row, keep
//     the row so squad/community context isn't broken): festival_comments,
//     festival_reactions, squad_playlist.added_by, community_shares.
//   - Delete entirely: music_profile, mood_logs, squad_members (this
//     user's memberships), contacts (both directions), announcement_interest,
//     community_share_votes, concert_album (+ its storage objects),
//     recommendation_cache, torneo_campeon_historial, user_badges, trends,
//     squad_tournament_votes, then the users row and finally auth.users.
//   - Squads this user owns: reassign owner_id to the longest-tenured
//     remaining member, or delete the squad if no members remain.
//   - Null out announcements.created_by / ganador_user_id (already
//     nullable; ganador_nombre stays as the historical record).

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

    return new Response(
      JSON.stringify({
        error:
          "El borrado de cuenta todavía no está implementado del lado del servidor. No se eliminó ningún dato.",
      }),
      { status: 501, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
