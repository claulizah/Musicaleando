'use client';

import { useTransition } from 'react';
import { deleteAnnouncement } from './actions';

export function DeleteAnnouncementButton({
  festivalId,
  announcementId,
}: {
  festivalId: string;
  announcementId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('¿Borrar este anuncio?')) return;
        startTransition(() => {
          deleteAnnouncement(festivalId, announcementId);
        });
      }}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      {pending ? 'Borrando…' : 'Borrar'}
    </button>
  );
}
