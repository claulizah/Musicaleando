-- Line-up: hora de fin, nivel del artista y una sola convención de hora.
--
-- 1) horario_fin: hasta cuándo toca el artista (el cartel de horarios trae
--    inicio y fin; antes el fin se leía y se tiraba).
-- 2) nivel: peso del artista en el cartel — 'estelar' (los grandes, arriba),
--    'destacado' (segunda línea) o 'general'. NULL se trata como general.
--    Lo capturas tú en el admin (la IA solo lo sugiere): no se infiere del
--    género ni de la fama.
-- 3) festival_lineup_candidates.nivel: la sugerencia de nivel que trae la
--    extracción de un cartel, para que llegue al formulario de revisión.
-- 4) Una sola convención de hora: festival_lineup.horario guarda la HORA DE
--    PARED del cartel escrita como UTC ("20:20" del cartel = 20:20+00). Los
--    conciertos ya cargados por el admin la cumplen; dos grupos de filas no:
--    - Corona Capital 2026: fechas guardadas como medianoche de México
--      (06:00 UTC). Pasan a 00:00 UTC = "solo se sabe el día".
--    - "Festival de Prueba — no publicar" (datos de prueba): horas guardadas
--      con offset de México (-06). Pasan a la hora de pared.
--    La conversión toma la hora local de México y conserva sus cifras como
--    UTC. Corre UNA sola vez: solo si la columna horario_fin aún no existe
--    (así volver a ejecutar la migración no vuelve a mover las horas).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'festival_lineup' and column_name = 'horario_fin'
  ) then
    update public.festival_lineup
    set horario = (horario at time zone 'America/Mexico_City') at time zone 'UTC'
    where horario is not null
      and festival_id in (
        'db505d30-4166-4c4d-80a6-caa8e8871a65',  -- Corona Capital 2026
        '98a76b35-7444-49b2-b21e-d2da344181d0'   -- Festival de Prueba — no publicar
      );
  end if;
end $$;

alter table public.festival_lineup add column if not exists horario_fin timestamptz;
alter table public.festival_lineup add column if not exists nivel text;
alter table public.festival_lineup drop constraint if exists festival_lineup_nivel_check;
alter table public.festival_lineup add constraint festival_lineup_nivel_check
  check (nivel is null or nivel in ('estelar', 'destacado', 'general'));
alter table public.festival_lineup drop constraint if exists festival_lineup_horario_fin_check;
alter table public.festival_lineup add constraint festival_lineup_horario_fin_check
  check (horario_fin is null or horario is null or horario_fin > horario);

alter table public.festival_lineup_candidates add column if not exists nivel text;
alter table public.festival_lineup_candidates drop constraint if exists festival_lineup_candidates_nivel_check;
alter table public.festival_lineup_candidates add constraint festival_lineup_candidates_nivel_check
  check (nivel is null or nivel in ('estelar', 'destacado', 'general'));
