-- mood_playlists.fuente solo permitía 'manual' y 'lastfm' — la nueva
-- búsqueda de canciones vía iTunes Search API en el admin (/mood) inserta
-- con fuente='itunes' y la vieja restricción lo rechaza con "violates check
-- constraint mood_playlists_fuente_check". Se amplía para incluir 'itunes'.
alter table mood_playlists drop constraint mood_playlists_fuente_check;
alter table mood_playlists add constraint mood_playlists_fuente_check
  check (fuente = any (array['manual'::text, 'lastfm'::text, 'itunes'::text]));
