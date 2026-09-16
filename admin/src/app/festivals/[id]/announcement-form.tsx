'use client';

import { useActionState, useState, useTransition } from 'react';
import { createAnnouncement, estimateSegmentAudience } from './actions';

const initialState = { error: '' };

// Mismo orden de géneros que usa el perfil musical en la app (src/lib/compat.ts)
// — mantener sincronizado si esa lista cambia.
const GENEROS = ['rock', 'electronica', 'pop', 'latin', 'indie', 'lofi', 'jazz', 'metal'];

export function AnnouncementForm({
  festivalId,
  sponsorNames,
}: {
  festivalId: string;
  sponsorNames: string[];
}) {
  const [tipo, setTipo] = useState<'simple' | 'rifa' | 'descuento'>('simple');
  const [targetCiudad, setTargetCiudad] = useState('');
  const [targetGenero, setTargetGenero] = useState('');
  const [audience, setAudience] = useState<number | null>(null);
  const [estimating, startEstimating] = useTransition();
  const [state, formAction, pending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await createAnnouncement(festivalId, formData);
      return result?.error ? { error: result.error } : initialState;
    },
    initialState,
  );

  const handleEstimate = () => {
    startEstimating(async () => {
      const res = await estimateSegmentAudience(festivalId, targetCiudad, targetGenero);
      setAudience(res.count ?? null);
    });
  };

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

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-600">
          Segmentar audiencia (opcional) — deja vacío para mostrar a todos
        </p>
        <div className="mt-2 flex gap-2">
          <input
            name="target_ciudad"
            value={targetCiudad}
            onChange={(e) => {
              setTargetCiudad(e.target.value);
              setAudience(null);
            }}
            placeholder="Ciudad (ej. Ciudad de México)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            name="target_genero"
            value={targetGenero}
            onChange={(e) => {
              setTargetGenero(e.target.value);
              setAudience(null);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Cualquier género</option>
            {GENEROS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        {(targetCiudad || targetGenero) && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleEstimate}
              disabled={estimating}
              className="text-xs underline disabled:opacity-50"
            >
              {estimating ? 'Calculando…' : 'Estimar alcance'}
            </button>
            {audience !== null && (
              <span className={`text-xs ${audience < 30 ? 'text-red-600' : 'text-gray-500'}`}>
                {audience} usuarios{audience < 30 ? ' — por debajo del mínimo de 30, no se podrá publicar' : ''}
              </span>
            )}
          </div>
        )}
      </div>

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
