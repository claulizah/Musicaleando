// Descuentos y preventas de un evento. Los captura el admin a mano (el 2x1 o
// el precio especial depende del banco/tarjeta y cambia por evento, así que
// no hay una regla fija: el detalle es texto libre por evento) y la app decide
// EN EL MOMENTO de dibujar si sigue vigente — no hace falta un proceso que
// los apague: un descuento con vigencia vencida, o de un evento que ya pasó
// o está archivado, simplemente deja de mostrarse. Copia idéntica en
// admin/src/lib/descuentos.ts (app y admin no comparten módulos;
// tests/unit/descuentos.test.mts vigila que no se desincronicen).
export type TipoDescuento = '2x1' | 'porcentaje' | 'precio_especial' | 'otro';

export const TIPOS_DESCUENTO: TipoDescuento[] = ['2x1', 'porcentaje', 'precio_especial', 'otro'];

export const TIPO_DESCUENTO_LABEL: Record<TipoDescuento, string> = {
  '2x1': '2x1',
  porcentaje: 'Descuento',
  precio_especial: 'Precio especial',
  otro: 'Promoción',
};

export type PromoFields = {
  fecha_fin: string;
  estado_evento?: string | null;
  tipo_descuento?: string | null;
  descuento_detalle?: string | null;
  descuento_vigente_hasta?: string | null;
  preventa_inicio?: string | null;
  preventa_fin?: string | null;
  preventa_detalle?: string | null;
};

// "Hoy" en México (fecha YYYY-MM-DD). México no tiene horario de verano
// desde 2022, así que UTC-6 fijo es exacto para el centro del país; se usa la
// misma referencia en toda la app para que un descuento "hasta el 30" no
// desaparezca a las 6 p.m. del 30 por leerse en UTC.
export function mexicoToday(now: Date): string {
  return new Date(now.getTime() - 6 * 3_600_000).toISOString().slice(0, 10);
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "2026-09-25" -> "25 sep" (a mano: no depende de Intl en el teléfono).
export function formatDiaCorto(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

function eventoVigente(f: PromoFields, hoy: string): boolean {
  return f.estado_evento !== 'archivado' && f.fecha_fin >= hoy;
}

const nonBlank = (s: string | null | undefined): s is string => Boolean(s && s.trim());

export function tipoDescuentoOf(f: PromoFields): TipoDescuento | null {
  return TIPOS_DESCUENTO.find((t) => t === f.tipo_descuento) ?? null;
}

// ¿Hay un descuento que mostrar hoy? Necesita tipo y detalle, no haber
// vencido su vigencia y que el evento no haya pasado ni esté archivado.
export function descuentoVigente(f: PromoFields, hoy: string): boolean {
  if (!tipoDescuentoOf(f) || !nonBlank(f.descuento_detalle)) return false;
  if (f.descuento_vigente_hasta && f.descuento_vigente_hasta < hoy) return false;
  return eventoVigente(f, hoy);
}

export type PreventaEstado = { estado: 'proxima' | 'activa'; label: string };

// Preventa: 'proxima' si empieza en el futuro, 'activa' si ya empezó (o no
// tiene fecha) y no ha terminado. Necesita al menos fecha de inicio o detalle.
export function preventaVigente(f: PromoFields, hoy: string): PreventaEstado | null {
  if (!f.preventa_inicio && !nonBlank(f.preventa_detalle)) return null;
  if (!eventoVigente(f, hoy)) return null;
  if (f.preventa_fin && f.preventa_fin < hoy) return null;
  if (f.preventa_inicio && f.preventa_inicio > hoy) {
    return { estado: 'proxima', label: `Preventa desde ${formatDiaCorto(f.preventa_inicio)}` };
  }
  return { estado: 'activa', label: f.preventa_fin ? `Preventa hasta ${formatDiaCorto(f.preventa_fin)}` : 'Preventa' };
}

// Texto corto de la etiqueta de descuento ("2x1", "Descuento"...).
export function descuentoBadge(f: PromoFields, hoy: string): string | null {
  const tipo = tipoDescuentoOf(f);
  return tipo && descuentoVigente(f, hoy) ? TIPO_DESCUENTO_LABEL[tipo] : null;
}

// "Hasta 30 sep", o null si el descuento no tiene vigencia.
export function descuentoVigenciaLabel(f: PromoFields): string | null {
  return f.descuento_vigente_hasta ? `Hasta ${formatDiaCorto(f.descuento_vigente_hasta)}` : null;
}

export function tienePromo(f: PromoFields, hoy: string): boolean {
  return descuentoVigente(f, hoy) || preventaVigente(f, hoy) !== null;
}
