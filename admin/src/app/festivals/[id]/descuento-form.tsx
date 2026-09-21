'use client';

import { useState, useTransition } from 'react';
import { updateDescuento } from './actions';

type Initial = {
  tipo: string | null;
  detalle: string | null;
  vigenteHasta: string | null;
  preventaInicio: string | null;
  preventaFin: string | null;
  preventaDetalle: string | null;
};

const inputClass = 'rounded-md border border-gray-300 px-3 py-2 text-sm';

export function DescuentoForm({ festivalId, initial }: { festivalId: string; initial: Initial }) {
  const [tipo, setTipo] = useState(initial.tipo ?? '');
  const [detalle, setDetalle] = useState(initial.detalle ?? '');
  const [vigenteHasta, setVigenteHasta] = useState(initial.vigenteHasta ?? '');
  const [preventaInicio, setPreventaInicio] = useState(initial.preventaInicio ?? '');
  const [preventaFin, setPreventaFin] = useState(initial.preventaFin ?? '');
  const [preventaDetalle, setPreventaDetalle] = useState(initial.preventaDetalle ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        startTransition(async () => {
          const result = await updateDescuento(festivalId, {
            tipo,
            detalle,
            vigenteHasta,
            preventaInicio,
            preventaFin,
            preventaDetalle,
          });
          if (result.error) {
            setError(result.error);
          } else {
            setError('');
            setSaved(true);
          }
        });
      }}
    >
      <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3">
        <p className="text-sm font-medium">Descuento</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass} aria-label="Tipo de descuento">
            <option value="">Sin descuento</option>
            <option value="2x1">2x1</option>
            <option value="porcentaje">Porcentaje de descuento</option>
            <option value="precio_especial">Precio especial</option>
            <option value="otro">Otra promoción</option>
          </select>
          {tipo && (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Vigente hasta
              <input type="date" value={vigenteHasta} onChange={(e) => setVigenteHasta(e.target.value)} className={inputClass} />
            </label>
          )}
        </div>
        {tipo && (
          <>
            <input
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              maxLength={200}
              placeholder="Detalle: banco o tarjeta y condiciones (ej. 2x1 los jueves con Banamex)"
              className={`${inputClass} w-full`}
            />
            <p className="text-xs text-gray-500">
              Obligatorio: el 2x1 depende del banco o la tarjeta y cambia por evento, así que la app muestra este
              texto tal cual. Sin vigencia, se muestra hasta que pase el evento.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3">
        <p className="text-sm font-medium">Preventa</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <label className="flex items-center gap-2">
            Desde
            <input type="date" value={preventaInicio} onChange={(e) => setPreventaInicio(e.target.value)} className={inputClass} />
          </label>
          <label className="flex items-center gap-2">
            Hasta
            <input type="date" value={preventaFin} onChange={(e) => setPreventaFin(e.target.value)} className={inputClass} />
          </label>
        </div>
        <input
          value={preventaDetalle}
          onChange={(e) => setPreventaDetalle(e.target.value)}
          maxLength={200}
          placeholder="Quién accede (ej. tarjetas Citibanamex, club de fans)"
          className={`${inputClass} w-full`}
        />
        <p className="text-xs text-gray-500">
          Déjalo todo vacío si no hay preventa. La app la muestra como &quot;Preventa desde …&quot; antes de que
          empiece y la oculta al terminar.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !error && <p className="text-sm text-green-700">Guardado.</p>}
      </div>
    </form>
  );
}
