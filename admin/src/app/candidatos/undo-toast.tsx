'use client';

import { useEffect, useState } from 'react';

const UNDO_WINDOW_SECONDS = 30;

// Ventana corta de "Deshacer" tras aprobar/rechazar (individual o en bulk) —
// sin historial de auditoría, solo esto. Se usa tanto desde CandidateActions
// (individual) como desde CandidatosList (bulk) para no duplicar el timer/UI.
export function UndoToast({
  message,
  onUndo,
  onExpire,
  pending,
}: {
  message: string;
  onUndo: () => void;
  onExpire: () => void;
  pending?: boolean;
}) {
  const [remaining, setRemaining] = useState(UNDO_WINDOW_SECONDS);

  useEffect(() => {
    if (remaining <= 0) {
      onExpire();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
      <span>{message}</span>
      <button type="button" disabled={pending} onClick={onUndo} className="font-medium underline disabled:opacity-50">
        {pending ? 'Deshaciendo…' : `Deshacer (${remaining}s)`}
      </button>
    </div>
  );
}
