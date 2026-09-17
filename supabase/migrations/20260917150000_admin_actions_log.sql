-- Bitácora simple de acciones del admin — hoy solo existe el "deshacer" de
-- 30 segundos (ventana corta), sin registro permanente de qué se hizo. Ver
-- prompt-siguiente-salud-sistema.md. Consultable por query directo o una
-- vista simple; no se pide UI en este ticket.
create table public.admin_actions_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users(id),
  action text not null check (
    action in ('aprobar', 'rechazar', 'editar', 'deshacer_aprobar', 'deshacer_rechazar')
  ),
  target_type text not null check (target_type in ('candidato', 'festival')),
  target_id uuid not null,
  is_bulk boolean not null default false,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_log_created_at_idx on public.admin_actions_log (created_at desc);
create index admin_actions_log_target_idx on public.admin_actions_log (target_type, target_id);

alter table public.admin_actions_log enable row level security;

create policy admin_actions_log_select_admin on public.admin_actions_log
  for select using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

create policy admin_actions_log_insert_own on public.admin_actions_log
  for insert with check (admin_id = auth.uid());
