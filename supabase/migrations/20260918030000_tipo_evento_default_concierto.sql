-- festivals.tipo tenía DEFAULT 'festival' — con 762 festivales reales, solo
-- 82 eran 'concierto' y 683 'festival', pese a que la mayoría son shows de
-- un solo acto. Causa: cualquier código que no confirmaba el tipo (curador
-- sin elegir, código.new sin tocar el <select>) caía en 'festival' por
-- default en vez de 'concierto'. Se corrige el default de la columna para
-- coincidir con el código ya corregido (candidatos/actions.ts,
-- festivals/new).
alter table festivals alter column tipo set default 'concierto';

-- Reclasificación automática SOLO de los casos inequívocos: un festival
-- real (Corona Capital, Flow Fest, Festival Nescafé Vaivén, Tecate
-- Peninsula, todos ya en la base) tiene varios artistas en su line-up — se
-- confirmó con datos reales que de los 683 marcados 'festival', 594 (87%)
-- tienen 0 o 1 artista, imposible que sean festivales reales. Los que
-- tienen 2+ artistas (89 casos, zona ambigua — hay shows tipo "tres
-- cantantes en un mismo cartel" que no son festivales en el sentido que
-- Claudia usa la palabra) NO se tocan aquí — quedan para que ella los
-- revise uno por uno con el nuevo control de tipo en /festivals/[id].
update festivals
set tipo = 'concierto'
where tipo = 'festival'
  and id in (
    select f.id
    from festivals f
    left join festival_lineup fl on fl.festival_id = f.id
    group by f.id
    having count(fl.id) <= 1
  );
