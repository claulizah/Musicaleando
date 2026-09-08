'use client';

import { useState, useTransition } from 'react';
import { hideReportedContent, dismissReport } from './actions';

export function ReportActions({
  reportId,
  contentType,
  contentId,
}: {
  reportId: string;
  contentType: 'festival_comment' | 'community_share';
  contentId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm('¿Ocultar este contenido? Deja de ser visible para todos.')) return;
            setError(null);
            startTransition(async () => {
              const result = await hideReportedContent(reportId, contentType, contentId);
              if (result.error) setError(result.error);
            });
          }}
          className="text-xs text-red-600 underline disabled:opacity-50"
        >
          Ocultar contenido
        </button>
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
