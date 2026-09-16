-- Two new ways to feed event_candidates without any external API:
-- 1. A public submission form (musicaleando.com/sugerir-evento) — anyone can
--    suggest a missing event. Writes go through a new Edge Function using
--    the service role key, never directly from the browser, so
--    event_candidates' existing admin-only RLS policies stay untouched.
-- 2. An admin "agregar desde link" flow — reuses the source_id/dedup
--    machinery already in place, just a different `source` value.

alter table public.event_candidates
  drop constraint event_candidates_source_check;

alter table public.event_candidates
  add constraint event_candidates_source_check
  check (source in ('ticketmaster', 'poster_image', 'sumision_publica', 'link'));

-- Simple IP-based rate limit for the public submission Edge Function (not
-- enforceable from a Postgres RPC alone, since Postgres never sees the
-- caller's real IP — the Edge Function reads it from the request and hashes
-- it before writing here, so this table never stores a raw IP address).
create table public.event_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index event_submission_attempts_ip_hash_created_at_idx
  on public.event_submission_attempts (ip_hash, created_at);

alter table public.event_submission_attempts enable row level security;
-- No policies: this table is only ever touched by the Edge Function using
-- the service role key (bypasses RLS by design), never by a client session.

-- Public bucket for posters attached to a public submission — the curator
-- needs to view the image from /candidatos, and the image itself isn't
-- sensitive, so public read is fine. Only the submit-event-candidate Edge
-- Function (service role) ever writes to it.
insert into storage.buckets (id, name, public)
values ('event-submission-posters', 'event-submission-posters', true)
on conflict (id) do nothing;
