'use client';

import { useTransition } from 'react';
import { deleteSponsor } from './actions';

export function DeleteSponsorButton({ sponsorId }: { sponsorId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('¿Borrar este patrocinador?')) return;
        startTransition(() => {
          deleteSponsor(sponsorId);
        });
      }}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      {pending ? 'Borrando…' : 'Borrar'}
    </button>
  );
}
