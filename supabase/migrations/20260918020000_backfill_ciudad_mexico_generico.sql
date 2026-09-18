-- Corrección de datos, no de esquema: 191 festivales quedaron con
-- ciudad='México' (el país, no una ciudad) porque Ticketmaster reporta así
-- city.name para muchas sedes de Ciudad de México — confirmado con datos
-- reales que state.name en el mismo raw_payload sí trae "Ciudad de México".
-- El sync (ticketmaster-sync) ya se corrigió para futuras corridas; esto
-- rellena lo ya aprobado, uniendo por el event_candidates que originó cada
-- festival (festival_id). Festivales de otras fuentes (imagen/link/manual)
-- con ciudad='México' no tienen event_candidates.raw_payload de
-- Ticketmaster que corregirlos y quedan como estaban.
update festivals f
set ciudad = ec.raw_payload -> '_embedded' -> 'venues' -> 0 -> 'state' ->> 'name'
from event_candidates ec
where ec.festival_id = f.id
  and f.ciudad = 'México'
  and ec.raw_payload -> '_embedded' -> 'venues' -> 0 -> 'state' ->> 'name' is not null;
