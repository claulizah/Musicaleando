'use client';

import { useActionState } from 'react';
import { createFestival } from './actions';
import { EventImageImporter } from './event-image-importer';
import { EventLinkImporter } from './event-link-importer';

const initialState = { error: '' };

export default function NewFestivalPage() {
  const [state, formAction, pending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await createFestival(formData);
      return result ?? initialState;
    },
    initialState,
  );

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-6 text-xl font-semibold">Nuevo festival</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input
            name="nombre"
            required
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Ciudad
          <input
            name="ciudad"
            required
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tipo
          <select
            name="tipo"
            defaultValue="festival"
            className="rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="festival">Festival</option>
            <option value="concierto">Concierto</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Fecha inicio
            <input
              type="date"
              name="fecha_inicio"
              required
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fecha fin
            <input
              type="date"
              name="fecha_fin"
              required
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Link de boletos (opcional, se puede agregar después)
          <input
            type="url"
            name="link_boletos"
            placeholder="https://…"
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear festival'}
        </button>
      </form>

      <div className="mt-8">
        <EventImageImporter />
        <EventLinkImporter />
      </div>
    </main>
  );
}
