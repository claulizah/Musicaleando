// festival_lineup.horario es timestamptz a propósito (el catálogo lo
// muestra con día+mes, útil en festivales de varios días) — el bug real no
// era el tipo de columna, era que un candidato extraído de imagen/link a
// veces solo trae la hora suelta ("17:00", sin fecha), y eso se mandaba tal
// cual a una columna que exige timestamp completo. Postgres lo rechazaba
// (invalid input syntax for type timestamp with time zone: "17:00") y el
// insert de line-up fallaba en silencio. Se combina con fecha_inicio del
// evento antes de insertar; un formato irreconocible se descarta (null) en
// vez de mandar algo que Postgres va a volver a rechazar.
export function normalizeHorario(fechaInicio: string, horario: string | null): string | null {
  if (!horario) return null;
  const trimmed = horario.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed; // ya trae fecha completa
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (match) {
    const [, hh, mm, ss] = match;
    return `${fechaInicio}T${hh.padStart(2, '0')}:${mm}:${ss ?? '00'}`;
  }
  return null;
}
