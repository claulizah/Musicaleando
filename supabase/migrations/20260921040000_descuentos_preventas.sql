-- Descuentos y preventas por evento (Fase 1, sin notificaciones push).
--
-- Los captura el admin a mano: el 2x1 o el precio especial depende del banco
-- o la tarjeta y cambia por evento, así que no hay una regla fija — el detalle
-- es texto libre. La app decide al dibujar si sigue vigente (fecha de vigencia,
-- evento pasado o archivado), por eso no hace falta ningún proceso que los apague.
--
--   tipo_descuento           '2x1' | 'porcentaje' | 'precio_especial' | 'otro'
--   descuento_detalle        banco/tarjeta y condiciones (obligatorio si hay tipo)
--   descuento_vigente_hasta  último día del descuento (opcional)
--   preventa_inicio/fin      ventana de la preventa (fin opcional)
--   preventa_detalle         quién accede (banco, tarjeta, club de fans...)
--
-- El banner de descuentos de la app (ej. el del 2x1 de los jueves) NO necesita
-- columnas: es la clave 'banner_descuentos' de app_config, editable desde el admin.
alter table public.festivals add column if not exists tipo_descuento text;
alter table public.festivals add column if not exists descuento_detalle text;
alter table public.festivals add column if not exists descuento_vigente_hasta date;
alter table public.festivals add column if not exists preventa_inicio date;
alter table public.festivals add column if not exists preventa_fin date;
alter table public.festivals add column if not exists preventa_detalle text;

alter table public.festivals drop constraint if exists festivals_tipo_descuento_check;
alter table public.festivals add constraint festivals_tipo_descuento_check
  check (tipo_descuento is null or tipo_descuento in ('2x1', 'porcentaje', 'precio_especial', 'otro'));

alter table public.festivals drop constraint if exists festivals_descuento_detalle_check;
alter table public.festivals add constraint festivals_descuento_detalle_check
  check (tipo_descuento is null or nullif(btrim(descuento_detalle), '') is not null);

alter table public.festivals drop constraint if exists festivals_preventa_fechas_check;
alter table public.festivals add constraint festivals_preventa_fechas_check
  check (preventa_inicio is null or preventa_fin is null or preventa_fin >= preventa_inicio);
