'use client';

import { useState, useTransition } from 'react';
import { updateTipo } from './actions';

export function TipoForm({ festivalId, initialTipo }: { festivalId: string; initialTipo: string }) {
  const [tipo, setTipo] = useState(initialTipo);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        startTransition(async () => {
          const result = await updateTipo(festivalId, tipo);
          if (result.error) {
            setError(result.error);
          } else {
            setError('');
            setSaved(true);
          }
        });
      }}
    >
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="festival">Festival</option>
        <option value="concierto">Concierto</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700">Guardado.</p>}
    </form>
  );
}
