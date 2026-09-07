'use client';

import { useActionState } from 'react';
import { createSponsor } from './actions';

const initialState = { error: '' };

export function NewSponsorForm() {
  const [state, formAction, pending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await createSponsor(formData);
      return result?.error ? { error: result.error } : initialState;
    },
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-sm">
        Nombre
        <input name="nombre" required className="rounded-md border border-gray-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contacto (opcional)
        <input name="contacto" className="rounded-md border border-gray-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Qué ofrece (opcional)
        <input
          name="ofrece"
          placeholder="ej. 2 boletos VIP, 20% de descuento…"
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Guardando…' : '+ Agregar patrocinador'}
      </button>
    </form>
  );
}
