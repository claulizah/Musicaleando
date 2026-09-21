// Line-up de un evento: día, hora y nivel de cada artista.
//
// CONVENCIÓN DE HORA (importante): festival_lineup.horario / horario_fin son
// timestamptz, pero guardan la HORA DE PARED del cartel escrita como si fuera
// UTC — "20:20" en el cartel se guarda como 20:20+00. No es una hora real de
// UTC: es la hora que dice el cartel, y se muestra tal cual (leyendo los
// campos UTC), sin importar la zona horaria del teléfono ni del sitio del
// evento (Cancún, Tijuana, CDMX...). Así los datos que ya existían (conciertos
// importados por el admin) y los nuevos usan la misma regla, y nada se
// desplaza 6 horas según dónde se lea. Ver admin/src/lib/lineupSchedule.ts
// (misma lógica, portada a mano — app y admin no comparten módulos).
//
// Una hora exactamente 00:00 significa "solo se sabe el día" (placeholder de
// fecha sin hora) y no se muestra como hora.
export type Nivel = 'estelar' | 'destacado' | 'general';
export const NIVEL_ORDER: Nivel[] = ['estelar', 'destacado', 'general'];

export type LineupItemLike = {
  horario: string | null;
  horario_fin?: string | null;
  nivel?: string | null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export function clockParts(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

// ¿Trae una hora de verdad (no solo el día)?
export function hasRealHorario(iso: string | null | undefined): boolean {
  const p = clockParts(iso);
  return !!p && !(p.hour === 0 && p.minute === 0 && p.second === 0);
}

export function formatHora24(iso: string | null | undefined): string | null {
  const p = clockParts(iso);
  if (!p || !hasRealHorario(iso)) return null;
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

// "20:20–21:20", "20:20" si no hay fin, null si no hay hora real.
export function formatRango(inicio: string | null | undefined, fin: string | null | undefined): string | null {
  const a = formatHora24(inicio);
  if (!a) return null;
  const b = formatHora24(fin);
  return b ? `${a}–${b}` : a;
}

// Día del festival al que pertenece un horario: un set a la 1:00 a.m. del
// sábado toca en la noche del viernes, así que las horas 00:00–05:59 cuentan
// para el día anterior. Un placeholder (solo fecha) cuenta para su propia fecha.
export function festivalDay(iso: string | null | undefined): string | null {
  const p = clockParts(iso);
  if (!p) return null;
  if (!hasRealHorario(iso) || p.hour >= 6) return p.date;
  const prev = new Date(Date.UTC(p.year, p.month - 1, p.day - 1));
  return isoDate(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate());
}

export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Agrupa el line-up por día para eventos de más de un día. Una fila sin
// horario no se puede ubicar sin inventar — va a "Sin día asignado" al final.
// Un evento de un solo día no se agrupa (devuelve null: lista plana).
export function groupLineupByDay<T extends LineupItemLike>(
  lineup: T[],
  fechaInicio: string | null,
  fechaFin: string | null,
): { day: string | null; label: string; items: T[] }[] | null {
  if (!fechaInicio || !fechaFin || fechaInicio === fechaFin) return null;

  const groups = new Map<string, T[]>();
  for (const item of lineup) {
    const key = festivalDay(item.horario) ?? '__sin_dia__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return [...groups.entries()]
    .map(([key, items]) => ({ day: key === '__sin_dia__' ? null : key, items }))
    .sort((a, b) => {
      if (a.day === null) return 1;
      if (b.day === null) return -1;
      return a.day.localeCompare(b.day);
    })
    .map((g) => ({ ...g, label: g.day ? formatDayLabel(g.day) : 'Sin día asignado' }));
}

export function nivelOf(item: { nivel?: string | null }): Nivel {
  return item.nivel === 'estelar' || item.nivel === 'destacado' ? item.nivel : 'general';
}

// Vista "por nivel" (como el cartel): estelares arriba, luego destacados y el
// resto. Los niveles vacíos no aparecen; se conserva el orden de entrada.
export function groupByNivel<T extends { nivel?: string | null }>(items: T[]): { nivel: Nivel; items: T[] }[] {
  return NIVEL_ORDER.map((nivel) => ({ nivel, items: items.filter((i) => nivelOf(i) === nivel) })).filter(
    (g) => g.items.length > 0,
  );
}

// Vista "por horario": por hora de inicio; lo que no tiene hora va al final.
export function sortByHorario<T extends LineupItemLike & { artista?: string }>(items: T[]): T[] {
  const real = items.filter((i) => hasRealHorario(i.horario));
  const rest = items.filter((i) => !hasRealHorario(i.horario));
  real.sort(
    (a, b) =>
      new Date(a.horario!).getTime() - new Date(b.horario!).getTime() ||
      (a.artista ?? '').localeCompare(b.artista ?? ''),
  );
  return [...real, ...rest];
}

// ¿Vale la pena ofrecer la vista por horario? Solo si alguien trae hora real.
export function hasSchedule(items: LineupItemLike[]): boolean {
  return items.some((i) => hasRealHorario(i.horario));
}
