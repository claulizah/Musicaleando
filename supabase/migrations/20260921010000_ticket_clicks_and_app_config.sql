-- 1) app_config: ajustes que la app lee al vuelo y que Claudia edita desde el
-- admin SIN necesitar un release nuevo. Hoy solo guarda la plantilla del link
-- de afiliado (clave 'affiliate_url_template'); el aviso recurrente de los
-- jueves podría vivir aquí también cuando se defina.
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

create policy app_config_select_all on public.app_config
  for select using (true);

create policy app_config_insert_admin on public.app_config
  for insert with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));

create policy app_config_update_admin on public.app_config
  for update
  using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin))
  with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));

create policy app_config_delete_admin on public.app_config
  for delete using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));

-- 2) ticket_clicks: un renglón por clic en "Comprar boletos". Solo lo mínimo:
-- evento, plataforma de destino, si el link llevó el parámetro de afiliado, y
-- fecha/hora — más el identificador anónimo del usuario (no hay correo ni
-- IP en ningún lado). Si el evento o la cuenta se borran, el clic se queda
-- como dato agregado sin ligarse a nadie (on delete set null).
create table if not exists public.ticket_clicks (
  id uuid primary key default gen_random_uuid(),
  festival_id uuid references public.festivals(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  plataforma text not null,
  afiliado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ticket_clicks_created_idx on public.ticket_clicks (created_at desc);
create index if not exists ticket_clicks_festival_idx on public.ticket_clicks (festival_id, created_at desc);

alter table public.ticket_clicks enable row level security;

create policy ticket_clicks_insert_own on public.ticket_clicks
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

create policy ticket_clicks_select_admin on public.ticket_clicks
  for select using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));
