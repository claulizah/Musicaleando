-- "songs" solo tenía policy de SELECT — cualquier inserción desde el
-- cliente era rechazada por RLS (deny por default). Se necesita para que
-- Trends comunitarios pueda crear una fila real (buscada en iTunes) al
-- compartir una canción, en vez de limitarse a las 41 canciones ficticias
-- ya sembradas (Sprint 2). Mismo patrón de confianza que festival_comments/
-- community_shares: cualquier usuario autenticado (incluye sesiones
-- anónimas, que ya tienen rol authenticated) puede insertar contenido
-- propio; la moderación post-hoc vive en content_reports, no aquí.
create policy songs_insert_authenticated on public.songs
  for insert to authenticated
  with check (true);
