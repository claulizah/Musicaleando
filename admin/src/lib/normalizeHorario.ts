// Toda hora del line-up se guarda como HORA DE PARED del cartel escrita como
// UTC ("20:20" → 20:20+00:00), sin convertir zonas horarias — ver la
// convención completa en lineupSchedule.ts. Este es el único punto por el que
// entra un horario a festival_lineup, venga de una imagen, de un link, de un
// CSV o de captura manual, así que aquí se garantiza que TODOS usen la misma
// regla.
//
// Formatos que acepta:
//   "17:00" / "17:00:30"            → se combina con la fecha del evento
//   "2026-10-03"                    → solo día: 00:00 (placeholder, sin hora)
//   "2026-10-03T20:00:00-06:00"     → conserva 20:00 y descarta el offset
//                                     (el cartel dice 20:00, no "02:00 UTC")
// Un formato irreconocible o una hora imposible (25:70) se descarta (null)
// en vez de mandar algo que Postgres va a rechazar o guardar mal.
const validClock = (hh: number, mm: number, ss: number) => hh <= 23 && mm <= 59 && ss <= 59;
const validDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export function normalizeHorario(fechaInicio: string, horario: string | null): string | null {
  if (!horario) return null;
  const trimmed = horario.trim();
  if (!trimmed) return null;

  const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (dateOnly) return validDate(dateOnly[1]) ? `${dateOnly[1]}T00:00:00+00:00` : null;

  const full = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
  if (full) {
    const [, date, hh, mm, ss = '00'] = full;
    return validDate(date) && validClock(+hh, +mm, +ss) ? `${date}T${hh}:${mm}:${ss}+00:00` : null;
  }

  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (clock) {
    const [, hh, mm, ss = '00'] = clock;
    return validDate(fechaInicio) && validClock(+hh, +mm, +ss)
      ? `${fechaInicio}T${hh.padStart(2, '0')}:${mm}:${ss}+00:00`
      : null;
  }
  return null;
}
