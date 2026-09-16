'use client';

import { useState, useTransition } from 'react';
import { approveCandidate, discardCandidate, type ApproveOverrides } from './actions';

type Props = {
  candidateId: string;
  completo: boolean;
  defaults: ApproveOverrides;
};

export function CandidateActions({ candidateId, completo, defaults }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // También se abre editando si el tipo no vino confirmado — no queremos que
  // "Aprobar" default en silencio a festival sin que el curador lo vea.
  const [editing, setEditing] = useState(!completo || !defaults.tipo);
  const [form, setForm] = useState(defaults);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveCandidate(candidateId, form);
      if (result.error) setError(result.error);
    });
  };

  const handleDiscard = () => {
    if (!confirm('¿Descartar este candidato? No se publicará.')) return;
    setError(null);
    startTransition(async () => {
      const result = await discardCandidate(candidateId);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      {editing && (
        <div className="grid grid-cols-2 gap-2 rounded-md bg-gray-50 p-3 text-sm">
          <label className="col-span-2 flex flex-col gap-1">
            Nombre
            <input
              className="rounded border border-gray-300 px-2 py-1"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            Ciudad
            <input
              className="rounded border border-gray-300 px-2 py-1"
              value={form.ciudad}
              onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            Tipo
            <select
              className="rounded border border-gray-300 px-2 py-1"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="">Sin confirmar</option>
              <option value="festival">Festival</option>
              <option value="concierto">Concierto</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Link de boletos (opcional)
            <input
              className="rounded border border-gray-300 px-2 py-1"
              value={form.link_boletos}
              onChange={(e) => setForm({ ...form, link_boletos: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            Fecha inicio
            <input
              type="date"
              className="rounded border border-gray-300 px-2 py-1"
              value={form.fecha_inicio}
              onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            Fecha fin (opcional)
            <input
              type="date"
              className="rounded border border-gray-300 px-2 py-1"
              value={form.fecha_fin}
              onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
            />
          </label>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={handleApprove}
          className="rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50"
        >
          Aprobar
        </button>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-gray-600 underline"
          >
            Editar antes de aprobar
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={handleDiscard}
          className="text-xs text-red-600 underline disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
