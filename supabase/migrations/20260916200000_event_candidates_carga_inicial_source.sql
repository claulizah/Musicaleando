-- One more event_candidates.source value, for the one-time bulk import of
-- events already published on API-less boleteras (Eticket, Superboletos,
-- AREMA, etc.) — kept distinct from a curator's one-off "link" addition so
-- it's identifiable later in /candidatos or a report (e.g. "how many of
-- today's candidates came from the initial bulk load vs. organic growth").
alter table public.event_candidates
  drop constraint event_candidates_source_check;

alter table public.event_candidates
  add constraint event_candidates_source_check
  check (source in ('ticketmaster', 'poster_image', 'sumision_publica', 'link', 'carga_inicial'));
