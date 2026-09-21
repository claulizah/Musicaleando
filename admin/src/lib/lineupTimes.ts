// Ayudas para capturar horarios de un cartel de line-up (ver lineupSchedule.ts
// para la convención de hora). Todo aquí es puro y está cubierto por pruebas.

// Pasa una hora escrita como en el cartel a "HH:MM" en 24 horas. Los carteles
// suelen imprimir "8:10" sin am/pm: con `assumePm` las horas 1–11 sin marca se
// leen como tarde/noche (13:00–23:00), que es lo normal en un horario de
// festival; una marca explícita ("8:10 pm", "8 AM") siempre manda.
export function to24h(text: string | null | undefined, assumePm = false): string | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(text ?? '');
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = m[2] === undefined ? 0 : Number(m[2]);
  const marker = m[3]?.toLowerCase();
  if (mm > 59 || hh > 23) return null;
  if (marker) {
    if (hh < 1 || hh > 12) return null;
    hh = marker === 'p' ? (hh === 12 ? 12 : hh + 12) : hh === 12 ? 0 : hh;
  } else if (assumePm && hh >= 1 && hh <= 11) {
    hh += 12;
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Arma horario / horario_fin (hora de pared como UTC) a partir del día del
// cartel y las horas en 24 h. Un set que arranca de 00:00 a 05:59 pertenece a
// la noche del día del cartel, así que cae en el día calendario siguiente; y
// si la hora de fin es menor que la de inicio (23:30–00:30) también cruza la
// medianoche.
export function buildHorarios(
  dia: string,
  inicio: string | null,
  fin: string | null,
): { horario: string | null; horario_fin: string | null; error?: string } {
  if (!inicio) return { horario: null, horario_fin: null };
  const at = (hhmm: string, extraDays: number) => {
    const [hh] = hhmm.split(':').map(Number);
    return { date: addDays(dia, (hh < 6 ? 1 : 0) + extraDays), hhmm: `${String(hh).padStart(2, '0')}:${hhmm.split(':')[1]}` };
  };
  const stamp = (x: { date: string; hhmm: string }) => `${x.date}T${x.hhmm}:00+00:00`;
  const start = at(inicio, 0);
  if (!fin) return { horario: stamp(start), horario_fin: null };
  let end = at(fin, 0);
  if (stamp(end) <= stamp(start)) end = at(fin, 1);
  if (stamp(end) <= stamp(start)) return { horario: stamp(start), horario_fin: null, error: 'La hora de fin debe ser después de la de inicio.' };
  if (Date.parse(stamp(end)) - Date.parse(stamp(start)) > 12 * 3_600_000) {
    return { horario: stamp(start), horario_fin: null, error: 'La hora de fin queda a más de 12 horas del inicio; revisa las horas.' };
  }
  return { horario: stamp(start), horario_fin: stamp(end) };
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "Domingo 16", "Viernes 4 Abril", "SÁBADO 15" → la fecha (YYYY-MM-DD) dentro
// del rango del evento que coincide; null si no hay coincidencia clara (el
// llamador cae a la fecha de inicio y el admin la corrige a mano).
export function resolveDayFromLabel(label: string | null | undefined, fechaInicio: string, fechaFin: string): string | null {
  if (!label) return null;
  const t = strip(label);
  const weekday = WEEKDAYS.findIndex((w) => t.includes(w));
  const month = MONTHS.findIndex((m) => t.includes(m));
  const dayNum = /\b(\d{1,2})\b/.exec(t)?.[1];
  if (weekday < 0 && !dayNum) return null;
  for (let date = fechaInicio, i = 0; date <= fechaFin && i < 62; date = addDays(date, 1), i++) {
    const d = new Date(`${date}T12:00:00Z`);
    if (weekday >= 0 && d.getUTCDay() !== weekday) continue;
    if (dayNum && d.getUTCDate() !== Number(dayNum)) continue;
    if (month >= 0 && d.getUTCMonth() !== month) continue;
    return date;
  }
  return null;
}
