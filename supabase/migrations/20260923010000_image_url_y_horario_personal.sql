-- (1) Imágenes de evento: Ticketmaster (780 candidatos, array `images` en
-- raw_payload) y eTicket (136, campo `image`) ya las traían y se guardaban
-- solo dentro de raw_payload sin usarse. Se extrae la URL a una columna real
-- en candidato y festival para poder mostrarla en la tarjeta.
alter table public.event_candidates add column image_url text;
alter table public.festivals add column image_url text;

-- Ticketmaster: la imagen 16:9 más cercana a ~640px de ancho (miniatura
-- liviana, no la de 2048px); si no hay 16:9, la más cercana de cualquier ratio.
update public.event_candidates c
set image_url = coalesce(
  (select i->>'url' from jsonb_array_elements(c.raw_payload->'images') i
    where i->>'ratio' = '16_9' and i->>'url' is not null
    order by abs((i->>'width')::int - 640) limit 1),
  (select i->>'url' from jsonb_array_elements(c.raw_payload->'images') i
    where i->>'url' is not null
    order by abs((i->>'width')::int - 640) limit 1)
)
where c.source = 'ticketmaster' and jsonb_typeof(c.raw_payload->'images') = 'array';

update public.event_candidates
set image_url = raw_payload->>'image'
where source = 'eticket' and raw_payload->>'image' like 'http%';

-- Festivales ya aprobados heredan la imagen de su candidato.
update public.festivals f
set image_url = c.image_url
from public.event_candidates c
where c.festival_id = f.id and c.image_url is not null and f.image_url is null;

-- (2) "Mi horario": artistas del line-up que el usuario quiere ver en ESTE
-- festival. Distinto de followed_artists (seguir para futuros eventos) y del
-- estado Voy/Tal vez/No voy del festival completo. Apunta a la fila de
-- line-up (no al artista) porque el horario/escenario es de esa fila.
create table public.festival_schedule_picks (
  user_id uuid not null references public.users(id) on delete cascade,
  lineup_id uuid not null references public.festival_lineup(id) on delete cascade,
  festival_id uuid not null references public.festivals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lineup_id)
);
create index festival_schedule_picks_festival_idx on public.festival_schedule_picks (user_id, festival_id);

alter table public.festival_schedule_picks enable row level security;
create policy schedule_picks_select_own on public.festival_schedule_picks for select using (auth.uid() = user_id);
create policy schedule_picks_insert_own on public.festival_schedule_picks for insert with check (auth.uid() = user_id);
create policy schedule_picks_delete_own on public.festival_schedule_picks for delete using (auth.uid() = user_id);
