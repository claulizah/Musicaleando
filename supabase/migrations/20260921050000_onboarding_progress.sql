-- Embudo de onboarding: hasta qué paso llegó cada usuario, aunque no termine.
--
-- Una fila por (usuario, paso) con la hora en que llegó por primera vez a ese
-- paso. Pasos (los define la app, ver src/lib/onboardingTracking.ts):
--   1 bienvenida · 2-11 las 10 preguntas del quiz · 12 revelación del
--   arquetipo · 13 mood · 14 ubicación (estados) · 15 onboarding completo.
-- Solo se guarda usuario (el id anónimo de sesión), paso y fecha/hora. La app
-- lo manda en segundo plano y sin esperar respuesta: si falla, se pierde ese
-- punto del embudo, nunca se le muestra nada al usuario ni se frena el flujo.
-- Al borrar la cuenta las filas se van solas (on delete cascade).
create table if not exists public.onboarding_progress (
  user_id uuid not null references public.users(id) on delete cascade,
  paso smallint not null check (paso between 1 and 30),
  paso_nombre text not null check (char_length(paso_nombre) between 1 and 40),
  alcanzado_en timestamptz not null default now(),
  primary key (user_id, paso)
);
alter table public.onboarding_progress enable row level security;

drop policy if exists onboarding_progress_insert_own on public.onboarding_progress;
create policy onboarding_progress_insert_own on public.onboarding_progress
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists onboarding_progress_select_own on public.onboarding_progress;
create policy onboarding_progress_select_own on public.onboarding_progress
  for select to authenticated using (user_id = auth.uid());

-- Embudo para el panel de métricas (solo admins, solo agregados). "Llegaron al
-- paso N" = usuarios cuyo paso más alto es >= N: así el embudo nunca sube de un
-- paso a otro, aunque alguien retome el quiz a la mitad (la app guarda las
-- respuestas en el teléfono) o haya empezado antes de existir este registro.
-- Se excluyen las identidades "Usuario eliminado" (no son personas).
-- "en_curso" = usuarios que avanzaron en los últimos 30 min sin terminar: aún
-- no se pueden contar como abandono.
create or replace function public.admin_onboarding_funnel()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  result jsonb;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin) then
    raise exception 'No autorizado.';
  end if;

  with reales as (
    select id from public.users where nombre is distinct from 'Usuario eliminado'
  ),
  por_usuario as (
    select p.user_id, max(p.paso) as paso_max, min(p.alcanzado_en) as inicio, max(p.alcanzado_en) as ultimo
    from public.onboarding_progress p
    join reales r on r.id = p.user_id
    group by p.user_id
  ),
  total_pasos as (
    select greatest(15, coalesce((select max(paso_max) from por_usuario), 0))::int as n
  )
  select jsonb_build_object(
    'generado_en', now(),
    'usuarios', (select count(*) from por_usuario),
    'primer_registro', (select min(inicio) from por_usuario),
    'en_curso', (select count(*) from por_usuario where paso_max < 15 and ultimo > now() - interval '30 minutes'),
    'pasos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'paso', s.paso,
        'nombre', (select min(p.paso_nombre) from public.onboarding_progress p where p.paso = s.paso),
        'llegaron', (select count(*) from por_usuario pu where pu.paso_max >= s.paso)
      ) order by s.paso)
      from generate_series(1, (select n from total_pasos)) as s(paso)
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_onboarding_funnel() from public;
grant execute on function public.admin_onboarding_funnel() to authenticated;
