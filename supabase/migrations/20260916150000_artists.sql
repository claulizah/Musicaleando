-- Ficha de artista: tabla real de artistas con ID estable, para agrupar
-- apariciones (line-up de festival o concierto de un solo acto) sin
-- depender de comparar texto suelto en cada consulta. `festival_lineup` ya
-- es la tabla puente evento<->artista (una fila por artista por evento,
-- tanto para festivales de varios actos como para un concierto de uno
-- solo) — se le agrega artist_id en vez de crear una tabla puente nueva.
create extension if not exists unaccent with schema extensions;

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.artists enable row level security;

-- Público de lectura, igual que festivals/festival_lineup (los fans lo
-- navegan sin sesión de admin, tanto desde la app como desde el sitio
-- público estático). Las escrituras solo pasan por el panel admin
-- (auto-población al aprobar un candidato o editar line-up a mano).
create policy artists_select_all on public.artists
  for select using (true);

create policy artists_insert_admin on public.artists
  for insert with check (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create policy artists_update_admin on public.artists
  for update using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

alter table public.festival_lineup add column artist_id uuid references public.artists(id);
create index festival_lineup_artist_id_idx on public.festival_lineup (artist_id);

-- Backfill único sobre el line-up ya existente en la base (no solo eventos
-- nuevos de aquí en adelante). Compara por nombre normalizado (sin acentos,
-- minúsculas, espacios colapsados) para no duplicar "Bad Bunny" vs
-- "bad bunny " — misma idea que normalizeArtistName() en el admin/TS, para
-- que el backfill y la auto-población en runtime usen el mismo criterio.
insert into public.artists (name, normalized_name)
select distinct on (normalized_name)
  trim(artista) as name,
  lower(trim(regexp_replace(extensions.unaccent(artista), '\s+', ' ', 'g'))) as normalized_name
from public.festival_lineup
where artista is not null and trim(artista) <> ''
on conflict (normalized_name) do nothing;

update public.festival_lineup fl
set artist_id = a.id
from public.artists a
where fl.artist_id is null
  and a.normalized_name = lower(trim(regexp_replace(extensions.unaccent(fl.artista), '\s+', ' ', 'g')));
