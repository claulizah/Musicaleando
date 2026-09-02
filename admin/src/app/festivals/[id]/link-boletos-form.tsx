'use client';

import { useState, useTransition } from 'react';
import { updateLinkBoletos } from './actions';

export function LinkBoletosForm({
  festivalId,
  initialLink,
}: {
  festivalId: string;
  initialLink: string;
}) {
  const [link, setLink] = useState(initialLink);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        startTransition(async () => {
          const result = await updateLinkBoletos(festivalId, link);
          if (result.error) {
            setError(result.error);
          } else {
            setError('');
            setSaved(true);
          }
        });
      }}
    >
      <input
        type="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="https://…"
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
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
