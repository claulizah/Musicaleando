-- Límite de tasa para las llamadas a Claude que disparan las funciones de
-- extracción del panel admin (extract-lineup-image, extract-event-from-link)
-- — ver prompt-siguiente-salud-sistema.md. El endpoint público
-- (submit-event-candidate) ya tenía su propio rate limit por IP
-- (event_submission_attempts); estas dos están gateadas por is_admin (ya
-- verificado en el código de ambas), pero sin ningún límite adicional —
-- esto es una segunda capa de defensa contra un loop/bug o una sesión de
-- admin comprometida, no contra abuso público (ese caso ya no aplica aquí).
create table public.admin_ai_calls (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id),
  function_name text not null,
  created_at timestamptz not null default now()
);

create index admin_ai_calls_admin_id_created_at_idx on public.admin_ai_calls (admin_id, created_at desc);

alter table public.admin_ai_calls enable row level security;

-- A diferencia de ticketmaster-sync, estas dos Edge Functions llaman con el
-- JWT del propio admin (no la service role key) — RLS sí aplica, así que
-- necesitan poder insertar y leer su propio conteo.
create policy admin_ai_calls_select_admin on public.admin_ai_calls
  for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create policy admin_ai_calls_insert_own on public.admin_ai_calls
  for insert with check (admin_id = auth.uid());
