-- Archivado de eventos vencidos (en vez de borrarlos). Verificado antes de
-- construir: NO existe hoy ningún job/función/trigger que borre festivals por
-- fecha (solo hay 3 cron jobs: trends, recomendaciones y ticketmaster-sync) —
-- los eventos pasados simplemente siguen en la tabla y la app los muestra
-- todos. Esto agrega el estado para poder ocultarlos de la app sin perder el
-- historial (detección de duplicados en re-anuncios, consulta desde el admin).
alter table public.festivals
  add column if not exists estado_evento text not null default 'activo';

alter table public.festivals
  drop constraint if exists festivals_estado_evento_check;
alter table public.festivals
  add constraint festivals_estado_evento_check
  check (estado_evento in ('activo', 'archivado'));

create index if not exists festivals_estado_evento_idx on public.festivals (estado_evento);

-- Archiva (nunca borra) lo que ya terminó. Se compara contra la fecha en
-- hora de México, no UTC: con UTC un evento del día D se archivaría a las
-- 18:00 locales del mismo día D.
create or replace function public.archive_past_festivals()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  update public.festivals
  set estado_evento = 'archivado'
  where estado_evento = 'activo'
    and fecha_fin < (now() at time zone 'America/Mexico_City')::date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.archive_past_festivals() from public;

-- Diario a las 10:00 UTC (04:00 en México), ya terminado el día anterior.
select cron.schedule(
  'archive-past-festivals-daily',
  '0 10 * * *',
  $$select public.archive_past_festivals();$$
);

-- Primera pasada ahora mismo, para los eventos que ya vencieron hoy.
select public.archive_past_festivals();
