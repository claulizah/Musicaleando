-- Ficha de lugar/recinto (venues) — mismo patrón que artists.sql: tabla real
-- con ID estable, para poder listar todos los eventos de un lugar sin
-- depender de comparar texto suelto. A diferencia de festival_lineup
-- (artista por evento), el lugar es del EVENTO COMPLETO, así que el FK va en
-- `festivals`, no en `festival_lineup`.
--
-- `state` se guarda como columna real (no derivada al vuelo como en
-- mexicoEstados.ts para festivals/candidates) porque venues es una tabla
-- chica y estable, y la necesitan tanto la app como el sitio público
-- estático, que no tienen el mapeo ciudad→estado del admin. Se calcula UNA
-- vez en el backfill reusando ESE MISMO mapeo (resolveEstado), nunca uno
-- nuevo — ver scripts/generate-venues-backfill.mts.
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  state text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.venues enable row level security;

-- Público de lectura, igual que artists/festivals — se navega sin sesión de
-- admin desde la app y desde el sitio público estático.
create policy venues_select_all on public.venues
  for select using (true);

create policy venues_insert_admin on public.venues
  for insert with check (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create policy venues_update_admin on public.venues
  for update using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

alter table public.festivals add column venue_id uuid references public.venues(id) on delete set null;
create index festivals_venue_id_idx on public.festivals (venue_id);

-- El backfill de datos (crear los venues reales y vincular los festivales
-- existentes) se hace aparte, en scripts/generate-venues-backfill.mts,
-- porque necesita el mapeo ciudad→estado de TypeScript (mexicoEstados.ts) —
-- no se reimplementa esa lógica en SQL para no tener dos copias que se
-- puedan desincronizar.
