// Utilidades de fecha para la vista de calendario mensual del admin —
// separado de dateBuckets.ts porque ahí se agrupa en baldes relativos a hoy
// (esta semana/este mes/próximamente) y aquí se arma una grilla de un mes
// calendario específico (con celdas de meses vecinos para completar semanas).
export const MONTH_LABEL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Semana lunes→domingo (convención habitual en México/Latinoamérica, no hay
// precedente previo en el código para esto).
const WEEKDAY_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export { WEEKDAY_LABEL };

export type CalendarCell = {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Distancia desde lunes (0) en vez del domingo=0 nativo de getDay().
function mondayIndex(jsWeekday: number): number {
  return (jsWeekday + 6) % 7;
}

export function clampMonth(year: number, month: number): { year: number; month: number } {
  // Normaliza meses fuera de 1-12 (ej. mes=0 al pedir "anterior" desde enero).
  const d = new Date(year, month - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const todayStr = toDateStr(new Date());
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingDays = mondayIndex(firstOfMonth.getDay());

  const cells: CalendarCell[] = [];
  const gridStart = new Date(year, month - 1, 1 - leadingDays);

  // Semanas completas (mínimo 5, hasta 6) para cubrir el mes completo.
  const totalCells = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dateStr = toDateStr(d);
    cells.push({
      date: dateStr,
      dayOfMonth: d.getDate(),
      isCurrentMonth: d.getMonth() === month - 1 && d.getFullYear() === year,
      isToday: dateStr === todayStr,
    });
  }
  return cells;
}

export function monthRangeBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}
