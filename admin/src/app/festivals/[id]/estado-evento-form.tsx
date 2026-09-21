'use client';

import { useState, useTransition } from 'react';
import { updateEstadoEvento } from './actions';

export function EstadoEventoForm({ festivalId, initialEstado }: { festivalId: string; initialEstado: string }) {
  const [estado, setEstado] = useState(initialEstado);
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
          const result = await updateEstadoEvento(festivalId, estado);
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
        value={estado}
        onChange={(e) => setEstado(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="activo">Activo (visible en la app)</option>
        <option value="archivado">Archivado (historial, oculto en la app)</option>
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
