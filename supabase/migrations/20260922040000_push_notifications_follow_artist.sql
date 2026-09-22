-- Infraestructura de push notifications + "seguir artista" (ver prompt
-- "Infraestructura de push notifications + seguir artista"). Dos tablas
-- nuevas, sin tocar nada existente:
--
--   user_push_tokens: un token de Expo Push por dispositivo. Un usuario
--   puede tener varios (varios dispositivos), así que NO es un campo único
--   en `users` — es su propia tabla, una fila por dispositivo. El token en
--   sí es único globalmente (identifica al dispositivo, no al usuario): si
--   alguien reinstala la app en el mismo teléfono bajo una sesión anónima
--   nueva, upsert-ear por push_token reasigna la fila al nuevo user_id en
--   vez de dejar un duplicado apuntando a una cuenta fantasma.
--
--   followed_artists: par (user_id, artist_id), igual de simple que
--   community_share_votes — "sigo a este artista" no necesita más columnas
--   que la marca de tiempo.
--
-- RLS: mismo patrón en las dos — cada usuario ve/escribe solo lo suyo
-- (auth.uid() = user_id), y el panel admin necesita SELECT sobre ambas para
-- resolver, al aprobar un evento, qué usuarios siguen a los artistas del
-- line-up y a qué tokens mandarles el push (ver admin/src/lib/pushNotifications.ts).
-- Nunca se le da al admin UPDATE/INSERT sobre estas tablas — solo lectura
-- para resolver destinatarios, y DELETE sobre user_push_tokens para poder
-- podar tokens inválidos que Expo reporta (dispositivo desinstaló la app o
-- revocó el permiso), mismo criterio que "no seguir mandando a un token
-- muerto" pedido en el ticket.

create table public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_push_tokens_user_id_idx on public.user_push_tokens (user_id);

alter table public.user_push_tokens enable row level security;

create policy user_push_tokens_select_own on public.user_push_tokens
  for select using (auth.uid() = user_id);

create policy user_push_tokens_insert_own on public.user_push_tokens
  for insert with check (auth.uid() = user_id);

create policy user_push_tokens_update_own on public.user_push_tokens
  for update using (auth.uid() = user_id);

create policy user_push_tokens_delete_own on public.user_push_tokens
  for delete using (auth.uid() = user_id);

create policy user_push_tokens_select_admin on public.user_push_tokens
  for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create policy user_push_tokens_delete_admin on public.user_push_tokens
  for delete using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create table public.followed_artists (
  user_id uuid not null references public.users(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create index followed_artists_artist_id_idx on public.followed_artists (artist_id);

alter table public.followed_artists enable row level security;

create policy followed_artists_select_own on public.followed_artists
  for select using (auth.uid() = user_id);

create policy followed_artists_insert_own on public.followed_artists
  for insert with check (auth.uid() = user_id);

create policy followed_artists_delete_own on public.followed_artists
  for delete using (auth.uid() = user_id);

create policy followed_artists_select_admin on public.followed_artists
  for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));
