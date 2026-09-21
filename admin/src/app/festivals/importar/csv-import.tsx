'use client';

import { useState, useTransition } from 'react';
import { confirmCsvImport, previewCsvImport, type ImportResult } from './actions';
import { defaultSelected, summarize, type PreviewRow, type RowStatus } from '@/lib/csvEventImport';

const STATUS_LABEL: Record<RowStatus, string> = {
  ok: 'Nuevo',
  reanuncio_archivado: 'Re-anuncio',
  duplicado_activo: 'Duplicado (activo)',
  duplicado_archivado: 'Duplicado (archivado)',
  duplicado_en_archivo: 'Repetido en el archivo',
  error: 'Error',
};

const STATUS_STYLE: Record<RowStatus, string> = {
  ok: 'bg-green-100 text-green-800',
  reanuncio_archivado: 'bg-blue-100 text-blue-800',
  duplicado_activo: 'bg-amber-100 text-amber-800',
  duplicado_archivado: 'bg-amber-100 text-amber-800',
  duplicado_en_archivo: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
};

export function CsvImport() {
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [headerless, setHeaderless] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [pending, startTransition] = useTransition();

  const handleFile = async (file: File | null) => {
    setError('');
    setResult(null);
    setRows(null);
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    startTransition(async () => {
      const res = await previewCsvImport(text);
      if (res.error || !res.rows) {
        setError(res.error ?? 'No se pudo leer el archivo.');
        return;
      }
      setRows(res.rows);
      setHeaderless(Boolean(res.usedHeaderless));
      setSelected(new Set(res.rows.filter(defaultSelected).map((r) => r.line)));
    });
  };

  const toggle = (line: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });

  const handleImport = () => {
    if (!rows) return;
    const toImport = rows.filter((r) => r.row && selected.has(r.line)).map((r) => r.row!);
    if (toImport.length === 0) return;
    startTransition(async () => {
      const res = await confirmCsvImport(toImport);
      setResult(res);
      if (res.created > 0) {
        // Lo ya importado sale de la vista previa para no reimportarlo dos veces.
        setRows(null);
        setSelected(new Set());
      }
    });
  };

  const counts = rows ? summarize(rows) : null;
  const importable = rows ? rows.filter((r) => r.row && selected.has(r.line)).length : 0;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Archivo CSV
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
      </label>
      <p className="text-xs text-gray-500">
        Columnas: <code>nombre, tipo_evento, ciudad, fecha_inicio, fecha_fin, link_boletos</code> (fechas
        AAAA-MM-DD; tipo_evento vacío = concierto; fecha_fin vacía = mismo día; la columna <code>id</code> es
        opcional). Se muestra una vista previa y no se guarda nada hasta que confirmes.
      </p>

      {pending && <p className="text-sm text-gray-500">Procesando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Se importaron {result.created} evento{result.created === 1 ? '' : 's'}
          {result.archivedOnCreate > 0 && ` (${result.archivedOnCreate} ya vencido${result.archivedOnCreate === 1 ? '' : 's'}, entraron como archivados)`}.
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-red-700">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.nombre}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rows && counts && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <strong>{fileName}</strong>: {rows.length} filas —{' '}
            {(Object.keys(counts) as RowStatus[])
              .filter((k) => counts[k] > 0)
              .map((k) => `${counts[k]} ${STATUS_LABEL[k].toLowerCase()}`)
              .join(' · ')}
          </p>
          {headerless && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              El archivo no trae fila de encabezados — se asumió el orden de columnas del catálogo. Revisa que la
              vista previa se vea bien antes de confirmar.
            </p>
          )}

          <div className="max-h-[32rem] overflow-auto rounded-md border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-2 py-2"></th>
                  <th className="px-2 py-2">Línea</th>
                  <th className="px-2 py-2">Estado</th>
                  <th className="px-2 py-2">Evento</th>
                  <th className="px-2 py-2">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-t border-gray-100 align-top">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        disabled={!r.row}
                        checked={selected.has(r.line)}
                        onChange={() => toggle(r.line)}
                      />
                    </td>
                    <td className="px-2 py-2 text-gray-400">{r.line}</td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="px-2 py-2">
                      {r.row ? (
                        <>
                          <span className="font-medium">{r.row.nombre}</span>
                          <br />
                          <span className="text-gray-500">
                            {r.row.tipo} · {r.row.ciudad} · {r.row.fecha_inicio}
                            {r.row.fecha_fin !== r.row.fecha_inicio ? ` → ${r.row.fecha_fin}` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">{r.raw.filter(Boolean).slice(0, 4).join(' · ') || '(fila vacía)'}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-600">{r.messages.join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={pending || importable === 0}
            onClick={handleImport}
            className="self-start rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? 'Importando…' : `Importar ${importable} seleccionado${importable === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  );
}
