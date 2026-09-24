-- Reporte Artista × Evento × Estado × Foro, desde el CATÁLOGO REAL (festivals),
-- solo con relaciones de la base: festival_lineup.artist_id -> artists,
-- festivals.venue_id -> venues (state, name). Nada se deriva de texto libre:
-- lo que no tiene artist_id / venue_id va a las listas de huecos.
-- Solo lectura. Ejecutar con: npx supabase db query --linked --file <este archivo>
-- (o usar scripts/reporte-artista-evento-estado-foro.mjs, que corre las
-- consultas y genera los CSV con BOM UTF-8 para Excel).

-- 1) Filas del reporte: una por (evento, artista vinculado).
select
  a.name            as artista,
  f.nombre          as evento,
  v.state           as estado,
  v.name            as foro,
  f.ciudad          as ciudad,
  f.fecha_inicio    as fecha_inicio,
  f.fecha_fin       as fecha_fin,
  f.tipo            as tipo,
  f.estado_evento   as estado_evento,
  (select string_agg(distinct c.source, ',') from public.event_candidates c where c.festival_id = f.id) as fuente,
  f.id              as festival_id
from public.festivals f
join public.festival_lineup l on l.festival_id = f.id and l.artist_id is not null
join public.artists a on a.id = l.artist_id
left join public.venues v on v.id = f.venue_id
order by v.state nulls last, a.name, f.fecha_inicio;

-- 2) Huecos: festivales aprobados SIN ningún artist_id en su line-up.
select
  f.nombre, f.ciudad, f.fecha_inicio, f.tipo, f.estado_evento,
  (select count(*) from public.festival_lineup l where l.festival_id = f.id) as filas_lineup,
  v.state as estado, v.name as foro,
  (select string_agg(distinct c.source, ',') from public.event_candidates c where c.festival_id = f.id) as fuente,
  f.id as festival_id
from public.festivals f
left join public.venues v on v.id = f.venue_id
where not exists (select 1 from public.festival_lineup l where l.festival_id = f.id and l.artist_id is not null)
order by f.fecha_inicio, f.nombre;

-- 3) Huecos: festivales aprobados SIN venue_id.
select f.nombre, f.ciudad, f.fecha_inicio, f.tipo, f.estado_evento,
  (select string_agg(distinct c.source, ',') from public.event_candidates c where c.festival_id = f.id) as fuente,
  f.id as festival_id
from public.festivals f
where f.venue_id is null
order by f.fecha_inicio, f.nombre;

-- Conteos de cobertura.
select
  count(*) as festivales_total,
  count(*) filter (where exists (select 1 from public.festival_lineup l where l.festival_id = f.id and l.artist_id is not null)) as con_artista,
  count(*) filter (where not exists (select 1 from public.festival_lineup l where l.festival_id = f.id and l.artist_id is not null)) as sin_artista,
  count(*) filter (where f.venue_id is null) as sin_venue,
  count(*) filter (where f.venue_id is null and not exists (select 1 from public.festival_lineup l where l.festival_id = f.id and l.artist_id is not null)) as sin_ambos
from public.festivals f;
