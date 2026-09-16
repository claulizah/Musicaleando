'use client';

import { useState, useTransition } from 'react';
import { estimateSegmentAudience, updateAnnouncementSegment } from './actions';

const GENEROS = ['rock', 'electronica', 'pop', 'latin', 'indie', 'lofi', 'jazz', 'metal'];

export function EditSegmentForm({
  festivalId,
  announcementId,
  initialCiudad,
  initialGenero,
  onClose,
}: {
  festivalId: string;
  announcementId: string;
  initialCiudad: string;
  initialGenero: string;
  onClose: () => void;
}) {
  const [ciudad, setCiudad] = useState(initialCiudad);
  const [genero, setGenero] = useState(initialGenero);
  const [audience, setAudience] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [estimating, startEstimating] = useTransition();

  const handleEstimate = () => {
    startEstimating(async () => {
      const res = await estimateSegmentAudience(festivalId, ciudad, genero);
      setAudience(res.count ?? null);
    });
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateAnnouncementSegment(festivalId, announcementId, ciudad, genero);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  };

  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-600">Editar segmentación — deja vacío para mostrar a todos</p>
      <div className="mt-2 flex gap-2">
        <input
          value={ciudad}
          onChange={(e) => {
            setCiudad(e.target.value);
            setAudience(null);
          }}
          placeholder="Ciudad"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={genero}
          onChange={(e) => {
            setGenero(e.target.value);
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
      {(ciudad || genero) && (
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
              {audience} usuarios{audience < 30 ? ' — por debajo del mínimo de 30' : ''}
            </span>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onClose} className="text-xs text-gray-600 underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
