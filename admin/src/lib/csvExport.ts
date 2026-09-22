// Exportación a CSV, 100% en el navegador — sin endpoint nuevo, los datos ya
// están cargados en la pantalla (mismo criterio que el resto del admin:
// nada nuevo del lado del servidor si no hace falta). UTF-8 con BOM para que
// Excel de Windows (el caso real: Claudia) no muestre acentos/ñ corruptos —
// problema clásico de un CSV en español sin BOM abierto ahí.

// RFC 4180 básico: solo se envuelve en comillas si el campo trae coma,
// comilla o salto de línea; las comillas internas se escapan doblándolas.
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvField).join(','));
  return lines.join('\r\n');
}

// Construir el CSV de una tabla de cientos/miles de filas es rápido en la
// práctica, pero se hace en una tarea aparte (setTimeout 0) para no congelar
// la UI en el frame en el que se hizo clic — el botón puede mostrar "Generando…"
// mientras tanto en vez de quedarse pegado sin respuesta.
export function downloadCsvAsync(filename: string, headers: string[], rows: string[][]): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const csv = toCsv(headers, rows);
      const BOM = '﻿';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 0);
  });
}

// "musicaleando-catalogo-2026-09-22.csv" — fecha de hoy en hora local, para
// que Claudia distinga descargas de distintos días.
export function csvFilename(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `musicaleando-${prefix}-${y}-${m}-${d}.csv`;
}
