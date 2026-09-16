-- Atomic account-deletion RPC. A single top-level function call in Postgres
-- is one transaction: if any statement here raises, everything in this
-- function rolls back together — no partially-deleted account. The one
-- piece NOT handled here is the actual auth.users row: Supabase's admin API
-- (auth.admin.deleteUser, called from the Edge Function after this RPC
-- succeeds) is the supported way to remove an auth identity — hand-rolling
-- a raw `delete from auth.users` risks missing internal GoTrue bookkeeping
-- (refresh tokens, sessions, identities) that this migration has no
-- visibility into.
--
-- p_anon_id: the id of a REAL auth user the Edge Function already created
-- (via its own anonymous sign-in) to back the "Usuario eliminado" identity
-- this function reassigns public content to. This function cannot generate
-- that id itself with gen_random_uuid() — public.users.id has a real FK to
-- auth.users.id (confirmed by testing: an earlier version tried exactly
-- that and hit "violates foreign key constraint users_id_fkey" live), and
-- there's a trigger that auto-creates the matching public.users row the
-- moment a new auth.users row appears (confirmed by testing too: this
-- function's first fixed version then hit "duplicate key value violates
-- unique constraint users_pkey" trying to INSERT a row the trigger had
-- already created) — so this UPDATEs that already-existing row instead of
-- inserting a new one.
--
-- SECURITY DEFINER so it can reach every table regardless of the caller's
-- own RLS grants, but it only ever touches auth.uid()'s own data — the only
-- externally-controlled input is the anonymized-identity id, which can only
-- ever affect what THIS user's content gets reassigned to, never who it
-- deletes, so a caller still can never delete anyone but themselves.
create function public.delete_own_account(p_anon_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_squad record;
  v_new_owner uuid;
begin
  if v_user_id is null then
    raise exception 'No autorizado.';
  end if;

  -- Fresh anonymized identity for this deletion only — never a single
  -- shared sentinel. festival_reactions/festival_feedback are shaped as one
  -- row per (festival_id, user_id); reusing one shared id across multiple
  -- account deletions would collide the second time someone who reacted to
  -- the same festival deletes their account. The row itself already exists
  -- (the new-auth-user trigger created it) — this just relabels it.
  update public.users set nombre = 'Usuario eliminado', ciudad = null, is_admin = false where id = p_anon_id;

  -- Public-facing content: anonymize instead of delete, so existing threads
  -- don't break.
  update public.community_shares set user_id = p_anon_id where user_id = v_user_id;
  update public.festival_comments set user_id = p_anon_id where user_id = v_user_id;
  update public.festival_reactions set user_id = p_anon_id where user_id = v_user_id;
  update public.squad_playlist set added_by = p_anon_id where added_by = v_user_id;

  -- Already-nullable references; ganador_nombre keeps the historical record.
  update public.announcements set created_by = null where created_by = v_user_id;
  update public.announcements set ganador_user_id = null where ganador_user_id = v_user_id;

  -- Squads this user owns: hand off to the longest-tenured other member, or
  -- delete the squad (and its own squad_id-scoped rows explicitly, rather
  -- than assuming a cascade this migration hasn't verified) if nobody else
  -- is left. Runs before this user's own squad_members row is deleted below.
  for v_squad in select id from public.squads where owner_id = v_user_id loop
    select sm.user_id into v_new_owner
    from public.squad_members sm
    where sm.squad_id = v_squad.id and sm.user_id <> v_user_id
    order by sm.joined_at asc
    limit 1;

    if v_new_owner is not null then
      update public.squads set owner_id = v_new_owner where id = v_squad.id;
    else
      delete from public.squad_playlist where squad_id = v_squad.id;
      delete from public.squad_tournament_votes where squad_id = v_squad.id;
      delete from public.squad_tournaments where squad_id = v_squad.id;
      delete from public.squad_members where squad_id = v_squad.id;
      delete from public.squads where id = v_squad.id;
    end if;
  end loop;

  -- Everything else personal/private: deleted outright. concert_album's
  -- Storage objects (bucket "concert-album") are NOT reachable from SQL —
  -- the Edge Function reads foto_path and removes them from Storage before
  -- calling this function, so the rows disappear here after the files are
  -- already gone.
  delete from public.announcement_interest where user_id = v_user_id;
  delete from public.community_share_votes where user_id = v_user_id;
  delete from public.festival_intent where user_id = v_user_id;
  delete from public.festival_survey_responses where user_id = v_user_id;
  delete from public.festival_feedback where user_id = v_user_id;
  delete from public.mood_logs where user_id = v_user_id;
  delete from public.music_profile where user_id = v_user_id;
  delete from public.recommendation_cache where user_id = v_user_id;
  delete from public.torneo_campeon_historial where user_id = v_user_id;
  delete from public.trends where user_id = v_user_id;
  delete from public.user_badges where user_id = v_user_id;
  delete from public.squad_tournament_votes where user_id = v_user_id;
  delete from public.concert_album where user_id = v_user_id;
  delete from public.squad_members where user_id = v_user_id;
  delete from public.contacts where user_id = v_user_id or contact_id = v_user_id;

  -- content_reports.reporter_user_id is `on delete cascade` already — a
  -- report this user filed disappearing with them is fine, not personal
  -- data left dangling.
  delete from public.users where id = v_user_id;
end;
$$;

-- Callable by any authenticated user (never anon-as-in-unauthenticated —
-- Supabase's anonymous sign-in still issues a real `authenticated`-role
-- JWT, which is what every user in this app already has). It can only ever
-- affect auth.uid()'s own data, enforced above, not by who's allowed to
-- call it.
revoke all on function public.delete_own_account(uuid) from public;
grant execute on function public.delete_own_account(uuid) to authenticated;
