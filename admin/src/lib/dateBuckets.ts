// Agrupación visual por sección de fecha — reutilizada como una opción más
// de "Agrupar" (junto a por evento/artista/estado que ya existían) en vez de
// una vista aparte, para no duplicar el mecanismo de secciones colapsables.
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
  if (diffDays < 0) return 'esta_semana'; // ya empezó/pasó — no se oculta, se muestra junto con lo inmediato
  if (diffDays <= 7) return 'esta_semana';
  if (start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth()) return 'este_mes';
  return 'proximamente';
}

export const DATE_BUCKET_ORDER: DateBucket[] = ['esta_semana', 'este_mes', 'proximamente', 'sin_fecha'];
