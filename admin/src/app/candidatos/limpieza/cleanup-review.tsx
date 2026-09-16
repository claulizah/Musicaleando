'use client';

import { useState, useTransition } from 'react';
import { applyNameCleanup } from './actions';

type Row = { id: string; before: string; after: string };

export function CleanupReview({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(rows.map((r) => r.id)));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error?: string; updated?: number } | null>(null);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No hay nombres que la limpieza segura cambiaría ahora mismo.</p>;
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    const updates = rows.filter((r) => selected.has(r.id)).map((r) => ({ id: r.id, nombre: r.after }));
    if (updates.length === 0) return;
    if (!confirm(`Vas a actualizar el nombre de ${updates.length} evento(s) ya publicado(s). ¿Confirmas?`)) return;
    setResult(null);
    startTransition(async () => {
      const res = await applyNameCleanup(updates);
      setResult(res);
    });
  };

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        {rows.length} nombre(s) cambiarían con la limpieza segura. Revisa antes/después y desmarca lo que no
        quieras aplicar.
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              aria-label={`Aplicar limpieza a ${r.before}`}
            />
            <div>
              <p className="text-gray-400 line-through">{r.before}</p>
              <p className="font-medium text-gray-800">{r.after}</p>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={selected.size === 0 || pending}
        onClick={handleApply}
        className="mt-4 rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Aplicando…' : `Aplicar limpieza a ${selected.size} seleccionado(s)`}
      </button>

      {result && (
        <p className={`mt-2 text-sm ${result.error ? 'text-red-600' : 'text-green-700'}`}>
          {result.error ? `Error: ${result.error}` : `Listo — ${result.updated} nombre(s) actualizado(s).`}
        </p>
      )}
    </div>
  );
}
