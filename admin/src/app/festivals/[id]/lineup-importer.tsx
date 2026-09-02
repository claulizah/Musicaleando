'use client';

import { useRef, useState, useTransition } from 'react';
import Papa from 'papaparse';
import { importLineup, type LineupRow } from './actions';

const EXPECTED_COLUMNS = ['artista', 'escenario', 'horario'];

export function LineupImporter({ festivalId }: { festivalId: string }) {
  const [rows, setRows] = useState<LineupRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError('');
    setResult('');
    setFileName(file.name);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        if (!headers.includes('artista')) {
          setError(
            `El CSV debe tener una columna "artista" (columnas encontradas: ${headers.join(', ') || 'ninguna'}). Columnas esperadas: ${EXPECTED_COLUMNS.join(', ')}.`,
          );
          setRows([]);
          return;
        }

        const parsed: LineupRow[] = res.data.map((r) => ({
          artista: r.artista ?? '',
          escenario: r.escenario ?? null,
          horario: r.horario ?? null,
        }));
        setRows(parsed);
      },
      error: (err) => setError(err.message),
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-4">
      <p className="mb-2 text-sm font-medium">Importar line-up desde CSV</p>
      <p className="mb-3 text-xs text-gray-500">
        Columnas: <code>artista</code> (obligatoria), <code>escenario</code>, <code>horario</code>
        {' '}(opcional, formato ISO como 2026-10-03T20:00:00-06:00).
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="text-sm"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {rows.length > 0 && !error && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-gray-600">
            {fileName}: {rows.length} filas listas para importar.
          </p>
          <div className="max-h-48 overflow-auto rounded-md border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1">Artista</th>
                  <th className="px-2 py-1">Escenario</th>
                  <th className="px-2 py-1">Horario</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1">{r.artista}</td>
                    <td className="px-2 py-1">{r.escenario}</td>
                    <td className="px-2 py-1">{r.horario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await importLineup(festivalId, rows);
                if (res.error) {
                  setError(res.error);
                } else {
                  setResult(`Se importaron ${res.imported} artistas.`);
                  setRows([]);
                  setFileName('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }
              })
            }
            className="mt-3 rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {pending ? 'Importando…' : `Confirmar importación (${rows.length})`}
          </button>
        </div>
      )}

      {result && <p className="mt-2 text-sm text-green-700">{result}</p>}
    </div>
  );
}
