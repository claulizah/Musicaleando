// Agrupación visual del listado de eventos por sección — mismo criterio y
// mismos 3 baldes que ya existían como filtro de fecha en useEventFilters
// (próximos 7 días / este mes / el resto), para no inventar un cuarto
// criterio de fecha distinto. Ver admin/src/lib/dateBuckets.ts (misma
// lógica, portada a mano — este repo no comparte módulos entre app y admin).
export type DateBucket = 'esta_semana' | 'este_mes' | 'proximamente' | 'sin_fecha';

export const DATE_BUCKET_LABEL: Record<DateBucket, string> = {
  esta_semana: 'Esta semana',
  este_mes: 'Este mes',
  proximamente: 'Próximamente',
  sin_fecha: 'Sin fecha',
};

export function dateBucketFor(fechaInicio: string | null): DateBucket {
  if (!fechaInicio) return 'sin_fecha';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(fechaInicio + 'T00:00:00');
  const diffDays = (start.getTime() - today.getTime()) / 86_400_000;
  if (diffDays <= 7) return 'esta_semana'; // incluye lo que ya empezó/pasó — no se oculta
  if (start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth()) return 'este_mes';
  return 'proximamente';
}

export const DATE_BUCKET_ORDER: DateBucket[] = ['esta_semana', 'este_mes', 'proximamente', 'sin_fecha'];
