'use client';

import { useState, useTransition } from 'react';
import { updateLineupNivel } from './actions';

// Nivel del artista en el cartel: estelar (arriba en la app), destacado o
// general. Se guarda al elegir; sin definir cuenta como general.
export function LineupNivelSelect({
  festivalId,
  rowId,
  nivel,
}: {
  festivalId: string;
  rowId: string;
  nivel: string | null;
}) {
  const [value, setValue] = useState(nivel ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  return (
    <span className="flex items-center gap-1">
      <select
        value={value}
        disabled={pending}
        aria-label="Nivel en el cartel"
        onChange={(e) => {
          const next = e.target.value;
          const previous = value;
          setValue(next);
          setError('');
          startTransition(async () => {
            const res = await updateLineupNivel(festivalId, rowId, next || null);
            if (res.error) {
              setValue(previous);
              setError(res.error);
            }
          });
        }}
        className="rounded border border-gray-300 px-1 py-0.5 text-xs disabled:opacity-50"
      >
        <option value="">Nivel: —</option>
        <option value="estelar">Estelar</option>
        <option value="destacado">Destacado</option>
        <option value="general">General</option>
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
