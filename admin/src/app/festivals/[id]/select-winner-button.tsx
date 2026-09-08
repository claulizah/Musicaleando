'use client';

import { useState, useTransition } from 'react';
import { selectRaffleWinner } from './actions';

export function SelectWinnerButton({
  festivalId,
  announcementId,
  interestCount,
}: {
  festivalId: string;
  announcementId: string;
  interestCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-1 flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending || interestCount === 0}
        onClick={() => {
          if (!confirm('¿Elegir un ganador al azar entre los interesados? No se puede deshacer.')) return;
          setError(null);
          startTransition(async () => {
            const result = await selectRaffleWinner(festivalId, announcementId);
            if (result.error) setError(result.error);
          });
        }}
        className="text-xs text-blue-600 underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Eligiendo…' : '🎲 Elegir ganador'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
