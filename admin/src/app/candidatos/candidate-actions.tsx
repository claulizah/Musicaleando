'use client';

import { useState, useTransition } from 'react';
import { approveCandidate, discardCandidate, undoApprove, undoDiscard, type ApproveOverrides } from './actions';
import { UndoToast } from './undo-toast';

type Props = {
  candidateId: string;
  completo: boolean;
  defaults: ApproveOverrides;
};

type UndoState = { kind: 'approve' | 'discard' } | null;

export function CandidateActions({ candidateId, completo, defaults }: Props) {
  const [pending, startTransition] = useTransition();
  const [undoPending, startUndoTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // También se abre editando si el tipo no vino confirmado — no queremos que
  // "Aprobar" default en silencio a festival sin que el curador lo vea.
  const [editing, setEditing] = useState(!completo || !defaults.tipo);
  const [form, setForm] = useState(defaults);
  const [undo, setUndo] = useState<UndoState>(null);
  const [done, setDone] = useState(false);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveCandidate(candidateId, form);
      if (result.error) setError(result.error);
      else {
        setUndo({ kind: 'approve' });
        setDone(true);
      }
    });
  };

  const handleDiscard = () => {
    if (!confirm('¿Descartar este candidato? No se publicará.')) return;
    setError(null);
    startTransition(async () => {
      const result = await discardCandidate(candidateId);
      if (result.error) setError(result.error);
      else {
        setUndo({ kind: 'discard' });
        setDone(true);
      }
    });
  };

  const handleUndo = () => {
    if (!undo) return;
    startUndoTransition(async () => {
      const result = undo.kind === 'approve' ? await undoApprove(candidateId) : await undoDiscard(candidateId);
      if (result.error) {
        setError(result.error);
        setUndo(null);
        // done sigue true: el undo falló, la acción original se mantiene.
        return;
      }
      setUndo(null);
      setDone(false);
    });
  };

  // Ya se aprobó/descartó en esta sesión — la tarjeta desaparece de la lista
  // en el próximo revalidate, pero mientras el toast de deshacer sigue
  // visible no tiene caso seguir mostrando los botones de acción.
  if (done) {
    return (
      <>
        {undo && (
          <UndoToast
            message={undo.kind === 'approve' ? 'Aprobado.' : 'Descartado.'}
            onUndo={handleUndo}
            onExpire={() => setUndo(null)}
            pending={undoPending}
          />
        )}
        {error && <p className="mt-2 text-xs text-red-600">No se pudo deshacer: {error}</p>}
      </>
    );
  }

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
