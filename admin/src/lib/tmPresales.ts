// Preventas de Ticketmaster -> columnas preventa_inicio / preventa_fin /
// preventa_detalle de `festivals` (Fase 1 de "Descuentos y preventas").
//
// Fuente: raw_payload.sales.presales = [{ name, startDateTime, endDateTime }]
// (ISO en UTC). Varias preventas del mismo evento se resumen en UNA ventana:
// el inicio más temprano y el fin más tardío, con los nombres concatenados en
// el detalle ("Preventa Banamex, Venta Fans, Venta anticipada Spotify").
//
// SE EXCLUYEN las entradas que NO son preventa: Ticketmaster también mete en
// `presales` la "Venta General Paquetes VIP" (50 filas reales) y "Venta General 1"
// (3), que duran hasta el día del evento — tomarlas estiraría la "preventa"
// meses, hasta el concierto. Dos reglas: (1) el nombre dice "venta general";
// (2) empieza a la vez o después de la venta general (sales.public.startDateTime).
// Si el evento no trae inicio de venta general, solo aplica la regla del nombre.
//
// Las fechas de la app son días de México (UTC-6, sin horario de verano desde
// 2022, igual que mexicoToday en src/lib/descuentos.ts): 05:59Z del día 21 es
// las 23:59 del día 20 en México, y así se guarda.

export type PresaleFields = {
  preventa_inicio: string; // YYYY-MM-DD
  preventa_fin: string; // YYYY-MM-DD
  preventa_detalle: string;
};

type RawPresale = { name?: unknown; startDateTime?: unknown; endDateTime?: unknown };

function mexicoDay(iso: unknown): string | null {
  if (typeof iso !== 'string') return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t - 6 * 3_600_000).toISOString().slice(0, 10);
}

export function presalesToFields(rawPayload: unknown): PresaleFields | null {
  const sales = (rawPayload as { sales?: { presales?: unknown; public?: { startDateTime?: unknown } } } | null)?.sales;
  const presales = Array.isArray(sales?.presales) ? (sales!.presales as RawPresale[]) : [];
  if (presales.length === 0) return null;

  const publicStart = typeof sales?.public?.startDateTime === 'string' ? new Date(sales.public.startDateTime).getTime() : NaN;

  const valid = presales
    .map((p) => ({
      name: typeof p.name === 'string' ? p.name.trim() : '',
      start: mexicoDay(p.startDateTime),
      end: mexicoDay(p.endDateTime),
      startMs: typeof p.startDateTime === 'string' ? new Date(p.startDateTime).getTime() : NaN,
    }))
    .filter((p) => p.name && p.start && p.end && p.end >= p.start)
    .filter((p) => !/venta\s+general/i.test(p.name))
    .filter((p) => Number.isNaN(publicStart) || p.startMs < publicStart);
  if (valid.length === 0) return null;

  const inicio = valid.map((p) => p.start!).sort()[0];
  const fin = valid.map((p) => p.end!).sort().at(-1)!;
  const names: string[] = [];
  for (const p of [...valid].sort((a, b) => a.start!.localeCompare(b.start!) || a.name.localeCompare(b.name))) {
    if (!names.includes(p.name)) names.push(p.name);
  }
  return { preventa_inicio: inicio, preventa_fin: fin, preventa_detalle: names.join(', ') };
}
