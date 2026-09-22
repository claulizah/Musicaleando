-- Tercera fuente de candidatos: Superboletos. Sin cron activado todavía
-- (ver admin/src/app/api/cron/superboletos-sync/route.ts, apagada a
-- propósito) — esta migración solo habilita el valor de `source` para
-- cuando Claudia decida activarla.
alter table public.event_candidates drop constraint if exists event_candidates_source_check;
alter table public.event_candidates add constraint event_candidates_source_check
  check (source in ('ticketmaster', 'eticket', 'superboletos', 'poster_image', 'sumision_publica', 'link', 'carga_inicial'));
