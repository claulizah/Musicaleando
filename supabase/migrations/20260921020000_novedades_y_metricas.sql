-- 1) "Qué hay de nuevo": mecanismo genérico y reutilizable para señalar una
-- función nueva la primera vez que el usuario llega a la pantalla donde vive.
-- novedades = el catálogo de avisos (lo edita Claudia desde el admin, sin
-- release); novedades_vistas = qué usuario ya cerró cuál. Un aviso deja de
-- mostrarse cuando el usuario lo cierra una vez, o al pasar vigente_hasta.
create table if not exists public.novedades (
  id text primary key,
  pantalla text not null,
  titulo text not null,
  cuerpo text not null,
  publicada_en timestamptz not null default now(),
  vigente_hasta timestamptz,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.novedades enable row level security;
create policy novedades_select_all on public.novedades for select using (true);
create policy novedades_insert_admin on public.novedades for insert with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));
create policy novedades_update_admin on public.novedades for update using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin)) with check (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));
create policy novedades_delete_admin on public.novedades for delete using (exists (select 1 from users u where u.id = auth.uid() and u.is_admin));

create table if not exists public.novedades_vistas (
  user_id uuid not null references public.users(id) on delete cascade,
  novedad_id text not null references public.novedades(id) on delete cascade,
  visto_en timestamptz not null default now(),
  primary key (user_id, novedad_id)
);
alter table public.novedades_vistas enable row level security;
create policy novedades_vistas_select_own on public.novedades_vistas for select to authenticated using (user_id = auth.uid());
create policy novedades_vistas_insert_own on public.novedades_vistas for insert to authenticated with check (user_id = auth.uid());

-- 2) Métricas para el admin. Casi todo sale de tablas que ya existen; lo único
-- que las políticas RLS impiden leer desde el admin (filas de OTROS usuarios)
-- se resuelve con esta función SECURITY DEFINER que solo responde a admins y
-- devuelve agregados, nunca filas individuales.
--
-- "Usuario activo" = tuvo al menos una ACCIÓN registrada ese día/semana (mood,
-- marcar interés, compartir, comentar, squad, contacto, reseña, álbum, clic de
-- compra, guardar perfil). La app no registra aperturas ni sesiones, así que
-- alguien que solo abre y mira no cuenta — es un piso, no el total real.
-- Se excluye lo generado por el sistema (trends, recomendaciones, insignias)
-- y las identidades "Usuario eliminado" que crea cada borrado de cuenta (no
-- son personas). Días y semanas (lunes a domingo) en hora de México.
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  tz constant text := 'America/Mexico_City';
  hoy date := (now() at time zone tz)::date;
  result jsonb;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin) then
    raise exception 'No autorizado.';
  end if;

  with actividad as (
    select user_id, (fecha at time zone tz)::date as dia from public.mood_logs
    union all select user_id, (updated_at at time zone tz)::date from public.festival_intent
    union all select user_id, (created_at at time zone tz)::date from public.community_shares
    union all select user_id, (created_at at time zone tz)::date from public.community_share_votes
    union all select user_id, (created_at at time zone tz)::date from public.festival_comments
    union all select user_id, (joined_at at time zone tz)::date from public.squad_members
    union all select owner_id, (created_at at time zone tz)::date from public.squads
    union all select user_id, (created_at at time zone tz)::date from public.contacts
    union all select user_id, (updated_at at time zone tz)::date from public.festival_feedback
    union all select user_id, (created_at at time zone tz)::date from public.concert_album
    union all select user_id, (updated_at at time zone tz)::date from public.music_profile
    union all select user_id, (created_at at time zone tz)::date from public.ticket_clicks where user_id is not null and plataforma <> 'prueba-automatica'
  ),
  reales as (select id, ciudad, fecha_registro from public.users where nombre is distinct from 'Usuario eliminado'),
  act as (
    select distinct a.user_id, a.dia from actividad a
    join reales r on r.id = a.user_id
  ),
  semanas8 as (
    select (date_trunc('week', hoy::timestamp) - (n * interval '7 days'))::date as semana
    from generate_series(0, 7) n
  ),
  dias14 as (select (hoy - n) as dia from generate_series(0, 13) n)
  select jsonb_build_object(
    'generado_en', now(),
    'usuarios', jsonb_build_object(
      'total', (select count(*) from reales),
      'con_perfil_musical', (select count(*) from public.music_profile mp join reales r on r.id = mp.user_id),
      'con_ciudad', (select count(*) from reales where nullif(ciudad, '') is not null),
      'registros_por_semana', coalesce((
        select jsonb_agg(jsonb_build_object('semana', s.semana, 'n', (
          select count(*) from reales u
          where (date_trunc('week', (u.fecha_registro at time zone tz)))::date = s.semana
        )) order by s.semana) from semanas8 s), '[]'::jsonb)
    ),
    'activos', jsonb_build_object(
      'hoy', (select count(distinct user_id) from act where dia = hoy),
      'ultimos_7d', (select count(distinct user_id) from act where dia > hoy - 7),
      'ultimos_30d', (select count(distinct user_id) from act where dia > hoy - 30),
      'por_dia', coalesce((
        select jsonb_agg(jsonb_build_object('dia', d.dia, 'n', (select count(distinct user_id) from act a where a.dia = d.dia)) order by d.dia)
        from dias14 d), '[]'::jsonb),
      'por_semana', coalesce((
        select jsonb_agg(jsonb_build_object('semana', s.semana, 'n', (
          select count(distinct user_id) from act a where date_trunc('week', a.dia::timestamp)::date = s.semana
        )) order by s.semana) from semanas8 s), '[]'::jsonb)
    ),
    'uso', jsonb_build_object(
      'squads_creados', (select count(*) from public.squads),
      'squads_creados_7d', (select count(*) from public.squads where created_at > now() - interval '7 days'),
      'membresias_squad', (select count(*) from public.squad_members),
      'shares_trends', (select count(*) from public.community_shares),
      'shares_trends_7d', (select count(*) from public.community_shares where created_at > now() - interval '7 days'),
      'moods_registrados', (select count(*) from public.mood_logs),
      'eventos_con_interes', (select count(distinct festival_id) from public.festival_intent),
      'marcas_de_interes', (select count(*) from public.festival_intent),
      'comentarios', (select count(*) from public.festival_comments),
      'clics_compra', (select count(*) from public.ticket_clicks where plataforma <> 'prueba-automatica'),
      'clics_compra_7d', (select count(*) from public.ticket_clicks where plataforma <> 'prueba-automatica' and created_at > now() - interval '7 days'),
      'usuarios_con_mi_horario', null
    ),
    'generos', coalesce((
      select jsonb_agg(jsonb_build_object('genero', g, 'n', n) order by n desc)
      from (select jsonb_array_elements_text(mp.generos) as g, count(*) as n from public.music_profile mp join reales r on r.id = mp.user_id group by 1) x), '[]'::jsonb),
    'ciudades', coalesce((
      select jsonb_agg(jsonb_build_object('ciudad', c, 'n', n) order by n desc)
      from (select coalesce(nullif(ciudad, ''), '(sin ciudad)') as c, count(*) as n from reales group by 1) y), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_metrics() from public;
grant execute on function public.admin_metrics() to authenticated;
