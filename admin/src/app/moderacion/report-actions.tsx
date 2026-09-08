'use client';

import { useState, useTransition } from 'react';
import { hideReportedContent, deleteReportedPhoto, dismissReport } from './actions';

export function ReportActions({
  reportId,
  contentType,
  contentId,
}: {
  reportId: string;
  contentType: 'festival_comment' | 'community_share' | 'concert_photo';
  contentId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {contentType === 'concert_photo' ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm('¿Eliminar esta foto? No se puede deshacer.')) return;
              setError(null);
              startTransition(async () => {
                const result = await deleteReportedPhoto(reportId, contentId);
                if (result.error) setError(result.error);
              });
            }}
            className="text-xs text-red-600 underline disabled:opacity-50"
          >
            Eliminar foto
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm('¿Ocultar este contenido? Deja de ser visible para todos.')) return;
              setError(null);
              startTransition(async () => {
                const result = await hideReportedContent(
                  reportId,
                  contentType as 'festival_comment' | 'community_share',
                  contentId,
                );
                if (result.error) setError(result.error);
              });
            }}
            className="text-xs text-red-600 underline disabled:opacity-50"
          >
            Ocultar contenido
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await dismissReport(reportId);
              if (result.error) setError(result.error);
            });
          }}
          className="text-xs text-gray-600 underline disabled:opacity-50"
        >
          Descartar reporte
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
