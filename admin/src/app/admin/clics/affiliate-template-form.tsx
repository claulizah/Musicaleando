'use client';

import { useState, useTransition } from 'react';
import { saveAffiliateTemplate } from './actions';

export function AffiliateTemplateForm({ initialValue }: { initialValue: string }) {
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
          const result = await saveAffiliateTemplate(value);
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
        placeholder="https://ticketmaster.evyy.net/c/…/…/…?u={url}"
        className="rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Guardando…' : value.trim() ? 'Guardar plantilla' : 'Quitar plantilla'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !error && <p className="text-sm text-green-700">Guardado — la app lo toma al abrir la pantalla de eventos.</p>}
      </div>
    </form>
  );
}
