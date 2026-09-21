'use client';

import { useTransition } from 'react';
import { deleteNovedad, setNovedadActiva } from './actions';

export function NovedadRowActions({ id, activa }: { id: string; activa: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex shrink-0 gap-3 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await setNovedadActiva(id, !activa)))}
        className="underline disabled:opacity-50"
      >
        {activa ? 'Pausar' : 'Activar'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`¿Borrar el aviso "${id}"? También se olvida quién ya lo vio.`)) {
            startTransition(async () => void (await deleteNovedad(id)));
          }
        }}
        className="text-red-600 underline disabled:opacity-50"
      >
        Borrar
      </button>
    </div>
  );
}
