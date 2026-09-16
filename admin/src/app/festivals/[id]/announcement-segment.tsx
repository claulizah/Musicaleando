'use client';

import { useState } from 'react';
import { EditSegmentForm } from './edit-segment-form';

export function AnnouncementSegment({
  festivalId,
  announcementId,
  targetCiudad,
  targetGenero,
}: {
  festivalId: string;
  announcementId: string;
  targetCiudad: string | null;
  targetGenero: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditSegmentForm
        festivalId={festivalId}
        announcementId={announcementId}
        initialCiudad={targetCiudad ?? ''}
        initialGenero={targetGenero ?? ''}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <span>
      {(targetCiudad || targetGenero) &&
        ` · segmentado: ${[targetCiudad, targetGenero].filter(Boolean).join(' · ')}`}{' '}
      <button type="button" onClick={() => setEditing(true)} className="underline">
        Editar segmentación
      </button>
    </span>
  );
}
