-- "¿Qué estados te interesa seguir?" — pregunta opcional/saltable de
-- onboarding (ver prompt-siguiente-filtros-catalogo-eventos.md). A
-- diferencia de un filtro de UI (pasajero), esto se guarda en el perfil
-- para habilitar targeting geográfico futuro (ej. notificar sobre un
-- festival en un estado de interés aunque el usuario no viva ahí). Vive en
-- music_profile (no una tabla nueva) porque ya es el perfil de un-registro-
-- por-usuario donde vive `generos`, con el mismo shape jsonb.
alter table public.music_profile
  add column estados_interes jsonb not null default '[]'::jsonb;
