-- Cuarta fuente de candidatos: Arema (API pública t3lb.arema.mx). La Edge
-- Function arema-sync está APAGADA por defecto (necesita AREMA_SYNC_ENABLED=true)
-- y NO hay cron programado — esta migración solo habilita el valor de `source`.
alter table public.event_candidates drop constraint if exists event_candidates_source_check;
alter table public.event_candidates add constraint event_candidates_source_check
  check (source in ('ticketmaster', 'eticket', 'superboletos', 'arema', 'poster_image', 'sumision_publica', 'link', 'carga_inicial'));
