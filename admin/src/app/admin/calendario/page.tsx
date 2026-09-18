import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { buildMonthGrid, clampMonth, monthRangeBounds, MONTH_LABEL, WEEKDAY_LABEL } from '@/lib/calendarMonth';

type Festival = {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
};

// Cuántos nombres se muestran por celda antes de resumir el resto como
// "+N más" — sin esto un día con muchos eventos (ya pasa: noviembre 2026
// tiene más de 200 en el mes) desbordaría la celda.
const MAX_NAMES_PER_DAY = 3;

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
        <p className="mt-2 text-sm text-gray-500">
          Tu cuenta ({admin.email}) no tiene permisos de administrador todavía.
        </p>
      </main>
    );
  }

  const { year: yearParam, month: monthParam } = await searchParams;
  const today = new Date();
  const requested = clampMonth(
    yearParam ? Number(yearParam) : today.getFullYear(),
    monthParam ? Number(monthParam) : today.getMonth() + 1,
  );
  const { year, month } = requested;
  const prev = clampMonth(year, month - 1);
  const next = clampMonth(year, month + 1);

  const cells = buildMonthGrid(year, month);
  const { start, end } = monthRangeBounds(year, month);

  const supabase = await createClient();
  // Traer festivales cuyo rango [fecha_inicio, fecha_fin] se traslape con el
  // mes visible (incluye multi-día que empiezan antes o terminan después).
  const { data: festivals } = await supabase
    .from('festivals')
    .select('id, nombre, fecha_inicio, fecha_fin')
    .lte('fecha_inicio', end)
    .gte('fecha_fin', start)
    .order('fecha_inicio', { ascending: true });

  // Multi-día: se muestra en CADA día que abarca (no solo el de inicio).
  // Decisión: el objetivo explícito de esta vista es "ver de un vistazo qué
  // hay agendado" — si Corona Capital dura 3 días, Claudia debe verlo en los
  // 3 días al escanear la grilla, no solo adivinar la duración desde el
  // primer día. El costo (repetir el nombre en varias celdas) es bajo: solo
  // 10 de 664 festivales en 2026 son multi-día.
  const byDate = new Map<string, Festival[]>();
  for (const f of (festivals ?? []) as Festival[]) {
    let cursor = f.fecha_inicio > start ? f.fecha_inicio : start;
    const last = f.fecha_fin < end ? f.fecha_fin : end;
    while (cursor <= last) {
      if (!byDate.has(cursor)) byDate.set(cursor, []);
      byDate.get(cursor)!.push(f);
      cursor = addDays(cursor, 1);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Calendario</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/admin" className="underline">
            ← Festivales
          </Link>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/admin/calendario?year=${prev.year}&month=${prev.month}`}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700"
        >
          ‹ Anterior
        </Link>
        <p className="text-lg font-medium capitalize">
          {MONTH_LABEL[month - 1]} {year}
        </p>
        <Link
          href={`/admin/calendario?year=${next.year}&month=${next.month}`}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700"
        >
          Siguiente ›
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 text-xs">
        {WEEKDAY_LABEL.map((w) => (
          <div key={w} className="bg-gray-50 px-2 py-1 text-center font-medium text-gray-500">
            {w}
          </div>
        ))}
        {cells.map((cell) => {
          const dayFestivals = byDate.get(cell.date) ?? [];
          const shown = dayFestivals.slice(0, MAX_NAMES_PER_DAY);
          const extra = dayFestivals.length - shown.length;
          return (
            <div
              key={cell.date}
              className={`min-h-[6rem] bg-white p-1.5 ${cell.isCurrentMonth ? '' : 'bg-gray-50 text-gray-300'}`}
            >
              <p className={`mb-1 text-right ${cell.isToday ? 'font-semibold text-black' : ''}`}>
                {cell.dayOfMonth}
              </p>
              <ul className="flex flex-col gap-0.5">
                {shown.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/festivals/${f.id}`}
                      className="block truncate rounded bg-black/5 px-1 py-0.5 leading-tight underline decoration-transparent hover:decoration-inherit"
                      title={f.nombre}
                    >
                      {f.nombre}
                    </Link>
                  </li>
                ))}
                {extra > 0 && <li className="px-1 text-gray-400">+{extra} más</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
