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
// Most of the actual deletion work lives in the public.delete_own_account()
// Postgres function (see the matching migration) so it runs as one atomic
// transaction — this function is a thin orchestrator around it:
//   1. Read this user's concert-album Storage object paths (before the RPC
//      deletes the rows that name them — Storage isn't reachable from SQL).
//   2. Create a fresh throwaway anonymous auth user to back the "Usuario
//      eliminado" identity the RPC reassigns public content to.
//      public.users.id turned out to have a real FK to auth.users.id (found
//      by testing, not by the earlier schema inspection — a first version
//      of this tried inserting that row with a bare gen_random_uuid() and
//      hit "violates foreign key constraint users_id_fkey" live), so the
//      anonymized identity needs an actual auth user behind it. Reusing the
//      app's own anonymous sign-in is the simplest way to get one.
//   3. Call the RPC as the caller's own session (respects the SECURITY
//      DEFINER function's internal auth.uid() check; no service role
//      needed for this part) with that id.
//   4. Remove the Storage objects found in step 1.
//   5. Delete the actual auth identity via the admin API — Supabase's
//      supported way to do this, not a raw SQL delete against auth.users
//      (that risks missing internal GoTrue bookkeeping this function has
//      no visibility into). Needs the service role key.
// The FK graph and the delete-vs-anonymize decisions this is built on are
// documented in the migration, not duplicated here.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "No autorizado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Acts as the caller for both identifying them AND running the RPC —
    // delete_own_account() is SECURITY DEFINER but self-scoped to
    // auth.uid(), so this never needs the service role key.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "No autorizado." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Storage isn't reachable from the SQL function — read paths first
    // using the caller's own session (RLS already lets a user read their
    // own concert_album rows).
    const { data: photos, error: photosError } = await callerClient
      .from("concert_album")
      .select("foto_path")
      .eq("user_id", userId);
    if (photosError) throw photosError;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: ghostAuth, error: ghostError } = await admin.auth.signInAnonymously();
    if (ghostError) throw ghostError;
    const anonId = ghostAuth.user!.id;

    const { error: rpcError } = await callerClient.rpc("delete_own_account", { p_anon_id: anonId });
    if (rpcError) throw rpcError;

    if (photos && photos.length > 0) {
      const { error: storageError } = await callerClient.storage
        .from("concert-album")
        .remove(photos.map((p) => p.foto_path));
      // The rows (and this user's access to them) are already gone — a
      // stray Storage object left behind isn't worth failing the whole
      // deletion over at this point.
      if (storageError) console.error("No se pudieron borrar fotos del álbum de conciertos:", storageError);
    }

    // Removing the auth identity itself — delete_own_account() already
    // confirmed this user's own data is gone.
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "No se pudo eliminar la cuenta. Intenta de nuevo." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
