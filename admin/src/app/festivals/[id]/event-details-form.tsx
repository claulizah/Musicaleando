'use client';

import { useState, useTransition } from 'react';
import { updateEventDetails } from './actions';

export function EventDetailsForm({
  festivalId,
  initialNombre,
  initialCiudad,
  initialFechaInicio,
  initialFechaFin,
}: {
  festivalId: string;
  initialNombre: string;
  initialCiudad: string;
  initialFechaInicio: string;
  initialFechaFin: string;
}) {
  const [nombre, setNombre] = useState(initialNombre);
  const [ciudad, setCiudad] = useState(initialCiudad);
  const [fechaInicio, setFechaInicio] = useState(initialFechaInicio);
  const [fechaFin, setFechaFin] = useState(initialFechaFin);
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
          const result = await updateEventDetails(festivalId, { nombre, ciudad, fecha_inicio: fechaInicio, fecha_fin: fechaFin });
          if (result.error) {
            setError(result.error);
          } else {
            setError('');
            setSaved(true);
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Nombre
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Ciudad
        <input
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Fecha inicio
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fecha fin
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700">Guardado.</p>}
    </form>
  );
}
