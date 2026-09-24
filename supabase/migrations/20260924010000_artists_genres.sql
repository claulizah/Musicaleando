-- Género musical de cada artista, curado a mano desde el admin (no se rellena
-- desde ninguna fuente automática). `genres` guarda ids de una lista controlada
-- (ver admin/src/lib/artistGenres.ts) para poder filtrar/personalizar después
-- sin fragmentarse en variantes de texto libre; `genre_other` es el texto libre
-- para lo que no encaje. Ambas nullable y sin default: no toca datos existentes.
alter table public.artists add column genres text[];
alter table public.artists add column genre_other text;
