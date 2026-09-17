// Agrupa el line-up por día para festivales de más de un día — la fecha de
// cada artista sale de festival_lineup.horario (timestamptz), que ya trae
// fecha completa por fila (verificado contra datos reales: Corona Capital
// 2026 tiene horario distinto por día — 20/21/22 nov — para cada artista).
// Si una fila no tiene horario, no hay forma de saber a qué día pertenece
// sin inventarlo — esas van a un grupo "Sin día asignado" al final en vez de
// perderse o agruparse mal. Un evento de un solo día (fecha_inicio ===
// fecha_fin) no se agrupa — se devuelve null para que el llamador mantenga
// la lista plana tal cual estaba.
export type LineupItemLike = { horario: string | null };

export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function groupLineupByDay<T extends LineupItemLike>(
  lineup: T[],
  fechaInicio: string | null,
  fechaFin: string | null,
): { day: string | null; label: string; items: T[] }[] | null {
  if (!fechaInicio || !fechaFin || fechaInicio === fechaFin) return null;

  const groups = new Map<string, T[]>();
  for (const item of lineup) {
    const day = item.horario ? item.horario.slice(0, 10) : null;
    const key = day ?? '__sin_dia__';
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
