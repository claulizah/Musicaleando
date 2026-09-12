'use client';

import { useActionState } from 'react';
import { addManualTrack } from './actions';

const initialState = { error: '' };

export function AddManualForm({ moods }: { moods: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await addManualTrack(formData);
      return result?.error ? { error: result.error } : initialState;
    },
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-sm">
        Mood
        <select name="mood_id" required className="rounded-md border border-gray-300 px-3 py-2">
          {moods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Título
        <input name="titulo" required className="rounded-md border border-gray-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Artista
        <input name="artista" required className="rounded-md border border-gray-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Género (opcional, para priorizar por perfil musical)
        <input
          name="genero"
          placeholder="ej. latin, rock, pop…"
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Guardando…' : '+ Agregar canción aprobada'}
      </button>
    </form>
  );
}
