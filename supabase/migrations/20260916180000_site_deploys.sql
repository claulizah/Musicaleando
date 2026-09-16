-- Registro de cuándo se disparó un rebuild manual del sitio público desde
-- el botón "Republicar sitio" en /candidatos — solo se usa para el rate
-- limit (no repetir un trigger antes de 3 minutos) y para mostrar "último
-- rebuild hace X" en la UI. No guarda nada sobre el resultado del build en
-- sí (eso vive en el dashboard de Cloudflare, fuera de este alcance).
create table public.site_deploys (
  id uuid primary key default gen_random_uuid(),
  triggered_at timestamptz not null default now(),
  triggered_by uuid not null references public.users(id)
);

create index site_deploys_triggered_at_idx on public.site_deploys (triggered_at desc);

alter table public.site_deploys enable row level security;

-- Mismo patrón admin-only que event_candidates/festival_lineup_candidates.
-- Sin política de update/delete: es un log de solo-inserción.
create policy site_deploys_select_admin on public.site_deploys
  for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create policy site_deploys_insert_admin on public.site_deploys
  for insert with check (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));
