-- Distinguishes festival (multi-day, multi-artist) from concierto
-- (single-artist show) events, so the app can filter/label them separately.
-- Existing rows default to 'festival' since every event loaded so far has
-- been a multi-day festival (Corona Capital 2026 + the sample festivals).
alter table public.festivals
  add column tipo text not null default 'festival'
  constraint festivals_tipo_check check (tipo in ('festival', 'concierto'));
