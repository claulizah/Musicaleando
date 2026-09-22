-- Segunda fuente automática de candidatos: eticket.mx (categorías Conciertos
-- y Festivales). Mismo patrón que Ticketmaster: siempre 'pendiente', nunca
-- publicación directa. Ver supabase/functions/eticket-sync/index.ts para el
-- porqué (JSON-LD público, revisión de Términos y de bloqueo de tráfico).
alter table public.event_candidates drop constraint if exists event_candidates_source_check;
alter table public.event_candidates add constraint event_candidates_source_check
  check (source in ('ticketmaster', 'eticket', 'poster_image', 'sumision_publica', 'link', 'carga_inicial'));

-- Una corrida diaria (07:15 UTC = 01:15 CDMX) — no necesita la frecuencia de
-- Ticketmaster (que tiene cuota de API y miles de eventos); aquí es lectura
-- de HTML público y unas decenas de eventos nuevos por día como mucho.
select
  cron.schedule(
    'eticket-sync-daily',
    '15 7 * * *',
    $$
    select
      net.http_post(
        url := 'https://ijwyykfuyeaahvxmaild.supabase.co/functions/v1/eticket-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'eticket_sync_secret')
        ),
        body := '{}'::jsonb
      );
    $$
  );
