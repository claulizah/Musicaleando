-- Cierra el hueco real que dejó el fix de "badge de duplicado en
-- imagen/link": `possible_duplicate_of` es FK a `festivals` únicamente, así
-- que un candidato que en realidad duplica a OTRO candidato pendiente
-- (detectado por findDuplicateMatch, que sí compara contra ambos) nunca se
-- podía persistir — solo se veía en el momento de la extracción, se perdía
-- al guardar. Se agrega una segunda columna, FK a event_candidates, en vez
-- de quitar la FK existente — así los dos casos (duplica un evento ya
-- publicado / duplica otro candidato pendiente) siguen teniendo integridad
-- referencial real, no solo un id suelto sin garantía.
alter table public.event_candidates
  add column if not exists possible_duplicate_candidate_of uuid references public.event_candidates(id) on delete set null;

create index if not exists event_candidates_possible_duplicate_candidate_of_idx
  on public.event_candidates (possible_duplicate_candidate_of);

-- Un candidato tiene UN posible duplicado a la vez, nunca de los dos tipos
-- simultáneamente (no tendría sentido: si duplica un evento ya aprobado, ESE
-- es el que importa mostrar) y nunca se apunta a sí mismo.
alter table public.event_candidates drop constraint if exists event_candidates_un_solo_duplicado_check;
alter table public.event_candidates add constraint event_candidates_un_solo_duplicado_check
  check (possible_duplicate_of is null or possible_duplicate_candidate_of is null);

alter table public.event_candidates drop constraint if exists event_candidates_no_self_duplicate_check;
alter table public.event_candidates add constraint event_candidates_no_self_duplicate_check
  check (possible_duplicate_candidate_of is null or possible_duplicate_candidate_of <> id);
