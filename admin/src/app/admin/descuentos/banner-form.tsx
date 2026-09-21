'use client';

import { useState, useTransition } from 'react';
import { saveBannerDescuentos } from './actions';

export function BannerForm({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        startTransition(async () => {
          const result = await saveBannerDescuentos(value);
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
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={200}
        placeholder="Ej. Jueves de 2x1: aplica con ciertos bancos y varía por evento — revisa el detalle en cada uno"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Guardando…' : value.trim() ? 'Guardar banner' : 'Quitar banner'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !error && <p className="text-sm text-green-700">Guardado.</p>}
      </div>
    </form>
  );
}
