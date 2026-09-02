'use client';

import { useTransition } from 'react';
import { deleteLineupRow } from './actions';

export function DeleteLineupRowButton({
  festivalId,
  rowId,
}: {
  festivalId: string;
  rowId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteLineupRow(festivalId, rowId);
        })
      }
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      Quitar
    </button>
  );
}
