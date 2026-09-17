'use client';

import { useState, useTransition } from 'react';
import { applyLineupRepair, type RepairPreviewItem, type RepairResult } from './actions';

export function RepairPreview({ items }: { items: RepairPreviewItem[] }) {
  const repairable = items.filter((i) => i.candidateId && i.lineup.length > 0 && i.currentLineupCount === 0);
  const [selected, setSelected] = useState<Set<string>>(new Set(repairable.map((i) => i.festivalId)));
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<RepairResult[] | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const totalArtists = items
      .filter((i) => ids.includes(i.festivalId))
      .reduce((sum, i) => sum + i.lineup.length, 0);
    if (
      !confirm(
        `Vas a agregar line-up a ${ids.length} festival(es) ya publicado(s) (${totalArtists} artista(s) en total). ¿Confirmas?`,
      )
    )
      return;
    setResults(null);
    startTransition(async () => {
      const { results } = await applyLineupRepair(ids);
      setResults(results);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm text-gray-600">
          {repairable.length} de {items.length} se pueden reparar automáticamente (line-up guardado y sin filas
          ya insertadas). Revisa antes de aplicar.
        </p>
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const isRepairable = item.candidateId && item.lineup.length > 0 && item.currentLineupCount === 0;
            return (
              <li key={item.festivalId} className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={!isRepairable}
                    checked={selected.has(item.festivalId)}
                    onChange={() => toggle(item.festivalId)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {item.festivalNombre} <span className="text-xs text-gray-400">({item.fechaInicio})</span>
                    </p>
                    {item.note && <p className="mt-1 text-xs text-amber-700">{item.note}</p>}
                    {item.lineup.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-0.5 text-xs text-gray-600">
                        {item.lineup.map((l, idx) => (
                          <li key={idx}>
                            🎤 {l.artista}
                            {l.escenario ? ` · ${l.escenario}` : ''}
                            {l.horarioRaw ? (
                              <span className="text-gray-400">
                                {' '}
                                ({l.horarioRaw} → {l.horarioNormalizado ?? 'no se pudo interpretar'})
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        disabled={selected.size === 0 || pending}
        onClick={handleApply}
        className="self-start rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Aplicando…' : `Aplicar reparación a ${selected.size} festival(es)`}
      </button>

      {results && (
        <div className="rounded-md border border-gray-200 bg-white p-3 text-xs">
          <ul className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={r.festivalId} className={r.error ? 'text-red-600' : 'text-green-700'}>
                {r.error ? '✗' : '✓'} {r.festivalNombre}
                {r.error ? `: ${r.error}` : ` — ${r.inserted} fila(s) insertada(s)`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
