'use client';

import { useState, useTransition } from 'react';
import { approveCandidate, discardCandidate } from './actions';

export function CandidateActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await approveCandidate(id);
              if (result.error) setError(result.error);
            });
          }}
          className="text-xs text-green-700 underline disabled:opacity-50"
        >
          Aprobar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await discardCandidate(id);
              if (result.error) setError(result.error);
            });
          }}
          className="text-xs text-red-600 underline disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
