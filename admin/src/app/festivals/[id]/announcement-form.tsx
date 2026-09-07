'use client';

import { useActionState, useState } from 'react';
import { createAnnouncement } from './actions';

const initialState = { error: '' };

export function AnnouncementForm({
  festivalId,
  sponsorNames,
}: {
  festivalId: string;
  sponsorNames: string[];
}) {
  const [tipo, setTipo] = useState<'simple' | 'rifa' | 'descuento'>('simple');
  const [state, formAction, pending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await createAnnouncement(festivalId, formData);
      return result?.error ? { error: result.error } : initialState;
    },
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <label className="flex flex-col gap-1 text-sm">
        Tipo
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="simple">Anuncio simple</option>
          <option value="rifa">Rifa (boletos donados)</option>
          <option value="descuento">Descuento especial</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Título
        <input name="titulo" required className="rounded-md border border-gray-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Descripción (opcional)
        <textarea name="descripcion" rows={2} className="rounded-md border border-gray-300 px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Patrocinador (opcional)
        <input
          name="sponsor_nombre"
          list="sponsor-names"
          placeholder="Nombre del patrocinador"
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        <datalist id="sponsor-names">
          {sponsorNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </label>
      {tipo === 'descuento' && (
        <label className="flex flex-col gap-1 text-sm">
          Código de descuento
          <input name="codigo_descuento" className="rounded-md border border-gray-300 px-3 py-2" />
        </label>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Publicando…' : '+ Publicar anuncio'}
      </button>
    </form>
  );
}
