'use client';

import { useState, useTransition } from 'react';
import { extractEventFromLink, type ExtractedEvent, type DuplicateMatch } from '../../candidatos/actions';
import { ExtractedEventPreview } from './extracted-event-preview';

export function EventLinkImporter() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedEvent | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFetch = () => {
    if (!url.trim()) return;
    setError('');
    setDone(false);
    setExtracted(null);
    setDuplicate(null);
    setLoading(true);
    startTransition(async () => {
      const res = await extractEventFromLink(url.trim());
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.extracted) {
        setExtracted(res.extracted);
        setDuplicate(res.duplicate ?? null);
      }
    });
  };

  const reset = () => {
    setExtracted(null);
    setDuplicate(null);
    setError('');
    setDone(false);
    setUrl('');
  };

  return (
    <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4">
      <p className="mb-2 text-sm font-medium">Agregar evento desde link</p>
      <p className="mb-3 text-xs text-gray-500">
        Pega la URL de la página de un evento específico (venue, promotora, red social). Se lee esa
        página puntual una sola vez — no es un buscador ni recorre el sitio. Si la página requiere
        login o es una app que no muestra contenido sin JavaScript, te lo avisamos para que completes
        el formulario a mano.
      </p>

      {!extracted && (
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={loading || pending || !url.trim()}
            onClick={handleFetch}
            className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? 'Leyendo…' : 'Extraer'}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {done && (
        <p className="mt-2 text-sm text-green-700">
          Listo — revisa/aprueba en{' '}
          <a href="/candidatos" className="underline">
            /candidatos
          </a>
          .
        </p>
      )}

      {extracted && !done && (
        <ExtractedEventPreview
          extracted={extracted}
          duplicate={duplicate}
          source="link"
          onChange={setExtracted}
          onDone={() => setDone(true)}
          onCancel={reset}
        />
      )}
    </div>
  );
}
