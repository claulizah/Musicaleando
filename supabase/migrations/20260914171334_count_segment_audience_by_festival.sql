-- La función original (2 args: p_ciudad, p_genero) contaba usuarios de TODA
-- la app que matchean ciudad/género — nunca cruzaba con el festival al que
-- el anuncio está ligado. El spec pide explícitamente el cruce
-- Users + MusicProfile + FestivalIntent del festival, así que el "segmento"
-- real es: gente con intención registrada para ESE festival (voy/tal_vez —
-- 'no_voy' no tiene sentido como audiencia de una promo de ese festival),
-- opcionalmente acotado por ciudad/género encima.
drop function if exists public.count_segment_audience(text, text);

create function public.count_segment_audience(p_festival_id uuid, p_ciudad text default null, p_genero text default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  result int;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin) then
    raise exception 'Solo administradores.';
  end if;

  select count(distinct u.id) into result
  from public.festival_intent fi
  join public.users u on u.id = fi.user_id
  left join public.music_profile mp on mp.user_id = u.id
  where fi.festival_id = p_festival_id
    and fi.status in ('voy', 'tal_vez')
    and (p_ciudad is null or p_ciudad = '' or u.ciudad = p_ciudad)
    and (p_genero is null or p_genero = '' or mp.generos @> to_jsonb(p_genero::text));

  return coalesce(result, 0);
end;
$$;
