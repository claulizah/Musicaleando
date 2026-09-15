-- Candidatos de eventos de fuentes externas (Ticketmaster Discovery API v2 por
-- ahora) para el catálogo de Festival Hub. Ningún candidato se publica al
-- usuario directamente: todo pasa por 'pendiente' y requiere aprobación
-- manual desde el panel admin, que es quien realmente inserta en `festivals`.
create table public.event_candidates (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'ticketmaster' check (source in ('ticketmaster')),
  source_id text not null,
  nombre text not null,
  ciudad text,
  venue text,
  fecha_inicio date,
  fecha_fin date,
  lineup jsonb not null default '[]'::jsonb,
  price_min numeric,
  price_max numeric,
  price_currency text,
  link_boletos text,
  raw_payload jsonb not null default '{}'::jsonb,
  completo boolean not null default false,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'descartado', 'cancelado', 'desaparecido')),
  -- Posible duplicado contra un festival ya cargado a mano (nombre+fecha+venue
  -- aproximados) — solo se reporta para revisión humana, nunca se auto-fusiona
  -- ni se bloquea la inserción del candidato.
  possible_duplicate_of uuid references public.festivals(id) on delete set null,
  -- Se llena cuando el admin aprueba y el candidato se materializa en un
  -- festival real; el candidato en sí nunca se borra (queda como historial).
  festival_id uuid references public.festivals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source, source_id)
);

create index event_candidates_estado_idx on public.event_candidates (estado);

alter table public.event_candidates enable row level security;

-- Mismo patrón admin-only que festival_lineup_candidates/content_reports. El
-- job de sync no pasa por estas políticas: escribe con la service role key
-- (bypass de RLS por diseño), gated por su propio secreto (ver Edge Function).
create policy event_candidates_select_admin on public.event_candidates
  for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create policy event_candidates_insert_admin on public.event_candidates
  for insert with check (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create policy event_candidates_update_admin on public.event_candidates
  for update using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create policy event_candidates_delete_admin on public.event_candidates
  for delete using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

-- Cron: llama la Edge Function ticketmaster-sync 2x/día (08:00 y 20:00 UTC).
-- La función se despliega con --no-verify-jwt y valida ella misma el header
-- x-sync-secret contra un secreto compartido guardado en Vault (nunca el
-- valor real en esta migración ni en ningún archivo del repo).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'ticketmaster-sync-twice-daily',
    '0 8,20 * * *',
    $$
    select
      net.http_post(
        url := 'https://ijwyykfuyeaahvxmaild.supabase.co/functions/v1/ticketmaster-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ticketmaster_sync_secret')
        ),
        body := '{}'::jsonb
      );
    $$
  );
