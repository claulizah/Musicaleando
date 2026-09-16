// Deriva el estado de la República a partir de la ciudad/venue guardado en
// texto libre — no existe (ni se agrega) una columna `estado` geográfica en
// festivals/event_candidates, para no tocar el pipeline de sync de
// Ticketmaster ni el modelo de datos existente. Es puramente una vista
// derivada al momento de agrupar en el panel.
//
// Cobertura: capitales de los 32 estados + zonas metropolitanas/ciudades
// grandes donde suelen anunciarse conciertos. Cualquier ciudad no mapeada
// cae en OTRO_ESTADO_LABEL en vez de romper el agrupado o quedar fuera del
// listado.

export const OTRO_ESTADO_LABEL = 'Otro / sin estado';

// NOTA sobre cobertura real (verificado contra los 342 candidatos con
// ciudad que había en la base al construir este mapeo): "México"/"Mexico"
// a secas (266 registros combinados) inicialmente se dejó fuera del mapeo
// por ambiguo — Claudia revisó a mano los conciertos reales detrás de ese
// valor y confirmó que todos son de Ciudad de México, así que sí se mapea.
// "Los Angeles" (una ciudad de EE.UU., no aplica) sigue A PROPÓSITO fuera
// del mapeo, cae en OTRO_ESTADO_LABEL como el resto de lo no identificable.
const CITY_TO_ESTADO: Record<string, string> = {
  // Ciudad de México
  'ciudad de mexico': 'Ciudad de México',
  'cdmx': 'Ciudad de México',
  'mexico city': 'Ciudad de México',
  'df': 'Ciudad de México',
  'iztacalco': 'Ciudad de México',
  'coyoacan': 'Ciudad de México',
  // Confirmado a mano (2026-09-16): todos los candidatos con ciudad="México"
  // o "Mexico" a secas son eventos reales en CDMX, no un catch-all genérico.
  'mexico': 'Ciudad de México',
  // Estado de México
  'toluca': 'Estado de México',
  'ecatepec': 'Estado de México',
  'naucalpan': 'Estado de México',
  'tlalnepantla': 'Estado de México',
  'metepec': 'Estado de México',
  'acolman': 'Estado de México',
  // Jalisco
  'guadalajara': 'Jalisco',
  'zapopan': 'Jalisco',
  'puerto vallarta': 'Jalisco',
  'tlaquepaque': 'Jalisco',
  'tlajomulco de zuniga': 'Jalisco',
  // Nuevo León
  'monterrey': 'Nuevo León',
  'san pedro garza garcia': 'Nuevo León',
  'san nicolas de los garza': 'Nuevo León',
  'guadalupe': 'Nuevo León',
  'apodaca': 'Nuevo León',
  // Puebla
  'puebla': 'Puebla',
  'cholula': 'Puebla',
  // Guanajuato
  'leon': 'Guanajuato',
  'guanajuato': 'Guanajuato',
  'irapuato': 'Guanajuato',
  'celaya': 'Guanajuato',
  'san miguel de allende': 'Guanajuato',
  'marfil': 'Guanajuato',
  // Baja California
  'tijuana': 'Baja California',
  'mexicali': 'Baja California',
  'ensenada': 'Baja California',
  'rosarito': 'Baja California',
  // Baja California Sur
  'la paz': 'Baja California Sur',
  'los cabos': 'Baja California Sur',
  'cabo san lucas': 'Baja California Sur',
  // Coahuila
  'saltillo': 'Coahuila',
  'torreon': 'Coahuila',
  // Chihuahua
  'chihuahua': 'Chihuahua',
  'ciudad juarez': 'Chihuahua',
  'cd. juarez': 'Chihuahua',
  'cd juarez': 'Chihuahua',
  // Sonora
  'hermosillo': 'Sonora',
  'ciudad obregon': 'Sonora',
  // Sinaloa
  'culiacan': 'Sinaloa',
  'mazatlan': 'Sinaloa',
  'los mochis': 'Sinaloa',
  // Tamaulipas
  'ciudad victoria': 'Tamaulipas',
  'tampico': 'Tamaulipas',
  'reynosa': 'Tamaulipas',
  'matamoros': 'Tamaulipas',
  'nuevo laredo': 'Tamaulipas',
  // Veracruz
  'xalapa': 'Veracruz',
  'veracruz': 'Veracruz',
  'coatzacoalcos': 'Veracruz',
  'boca del rio': 'Veracruz',
  'orizaba': 'Veracruz',
  // Yucatán
  'merida': 'Yucatán',
  // Quintana Roo
  'cancun': 'Quintana Roo',
  'playa del carmen': 'Quintana Roo',
  'chetumal': 'Quintana Roo',
  'tulum': 'Quintana Roo',
  // Michoacán
  'morelia': 'Michoacán',
  'uruapan': 'Michoacán',
  // Querétaro
  'queretaro': 'Querétaro',
  'santiago de queretaro': 'Querétaro',
  'el marques': 'Querétaro',
  'huimilpan': 'Querétaro',
  // San Luis Potosí
  'san luis potosi': 'San Luis Potosí',
  // Aguascalientes
  'aguascalientes': 'Aguascalientes',
  // Zacatecas
  'zacatecas': 'Zacatecas',
  // Oaxaca
  'oaxaca': 'Oaxaca',
  'oaxaca de juarez': 'Oaxaca',
  // Chiapas
  'tuxtla gutierrez': 'Chiapas',
  'san cristobal de las casas': 'Chiapas',
  'tapachula': 'Chiapas',
  // Tabasco
  'villahermosa': 'Tabasco',
  // Campeche
  'campeche': 'Campeche',
  // Durango
  'durango': 'Durango',
  // Nayarit
  'tepic': 'Nayarit',
  // Colima
  'colima': 'Colima',
  'manzanillo': 'Colima',
  // Morelos
  'cuernavaca': 'Morelos',
  'tehuixtla': 'Morelos',
  // Hidalgo
  'pachuca': 'Hidalgo',
  // Tlaxcala
  'tlaxcala': 'Tlaxcala',
  // Guerrero
  'acapulco': 'Guerrero',
  'chilpancingo': 'Guerrero',
  'ixtapa': 'Guerrero',
  // Sinaloa/others without dedicated section already covered above
};

function normalizeCityKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// A venue string is often "Ciudad, Estado" or "Ciudad de X" — this checks
// the raw ciudad value, then falls back to matching any known city name
// that appears as a substring (covers "Guadalajara, Jal." style values).
// Picks the LONGEST matching key, not the first found, on purpose: a short
// fragment like a bare "juarez" would otherwise wrongly match inside
// "Acapulco de Juárez" (real value found in the data — that's Guerrero, not
// Chihuahua) before a more specific key gets a chance.
export function resolveEstado(ciudad: string | null | undefined): string {
  if (!ciudad) return OTRO_ESTADO_LABEL;
  const key = normalizeCityKey(ciudad);
  if (CITY_TO_ESTADO[key]) return CITY_TO_ESTADO[key];

  let bestMatch: { city: string; estado: string } | null = null;
  for (const [city, estado] of Object.entries(CITY_TO_ESTADO)) {
    if (key.includes(city) && (!bestMatch || city.length > bestMatch.city.length)) {
      bestMatch = { city, estado };
    }
  }
  return bestMatch?.estado ?? OTRO_ESTADO_LABEL;
}
