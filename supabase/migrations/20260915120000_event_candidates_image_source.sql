-- Extends event_candidates (from the Ticketmaster-only branch) to also
-- accept curator-uploaded poster/flyer images as a source, and to carry the
-- festival-vs-concierto classification (inferred from the image when
-- possible, left null for the curator to confirm otherwise — same rule as
-- festivals.tipo).
alter table public.event_candidates
  add column tipo text check (tipo in ('festival', 'concierto'));

alter table public.event_candidates
  drop constraint event_candidates_source_check;

alter table public.event_candidates
  add constraint event_candidates_source_check check (source in ('ticketmaster', 'poster_image'));
