'use client';

import { useState, useTransition } from 'react';
import {
  extractEventFromLink,
  createEventCandidates,
  type ExtractedEvent,
  type ExtractedEventWithDuplicate,
  type DuplicateMatch,
} from '../../candidatos/actions';
import { ExtractedEventPreview } from './extracted-event-preview';

function summarize(e: ExtractedEvent): string {
  const parts = [e.nombre ?? '(sin nombre)'];
  if (e.fecha_inicio) parts.push(e.fecha_inicio);
  if (e.ciudad) parts.push(e.ciudad);
  if (e.venue) parts.push(e.venue);
  return parts.join(' · ');
}

// Listing pages return several events at once — shown as a checklist so the
// curator picks which ones to add in one batch, instead of full per-item
// editing (that's still available afterward from /candidatos itself).
function MultiEventPicker({ events, onDone }: { events: ExtractedEventWithDuplicate[]; onDone: () => void }) {
  // Duplicate-flagged rows start unchecked so a bulk "add all" never
  // silently recreates something that already exists — the curator has to
  // deliberately check one of those if they really want a new candidate
  // anyway.
  const [checked, setChecked] = useState<boolean[]>(events.map((e) => !e.duplicate));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  const toggle = (i: number) => setChecked((prev) => prev.map((c, idx) => (idx === i ? !c : c)));

  const handleAdd = () => {
    const selected = events.filter((_, i) => checked[i]);
    if (selected.length === 0) return;
    startTransition(async () => {
      const res = await createEventCandidates(selected, 'link');
      setResult(res);
      if (res.errors.length === 0) onDone();
    });
  };

  const selectedCount = checked.filter(Boolean).length;

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-md bg-gray-50 p-3 text-sm">
      <p className="text-xs font-medium text-gray-600">
        Esta página parece un listado — se encontraron {events.length} eventos. Elige cuáles agregar:
      </p>
      <ul className="flex flex-col gap-2">
        {events.map((e, i) => (
          <li key={i} className="flex items-start gap-2 rounded border border-gray-200 bg-white p-2">
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() => toggle(i)}
              className="mt-0.5"
            />
            <div>
              <p>{summarize(e)}</p>
              {e.duplicate && (
                <p className="text-xs text-amber-700">
                  Posible duplicado de {e.duplicate.type === 'festival' ? 'un festival ya aprobado' : 'un candidato pendiente'}:{' '}
                  {e.duplicate.nombre}
                </p>
              )}
              {e.lineup.length > 0 && (
                <p className="text-xs text-gray-500">Line-up: {e.lineup.length} artista{e.lineup.length === 1 ? '' : 's'}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {result && result.errors.length > 0 && (
        <div className="rounded bg-red-50 p-2 text-xs text-red-700">
          {result.created} agregado{result.created === 1 ? '' : 's'}. Fallaron: {result.errors.join('; ')}
        </div>
      )}
      <button
        type="button"
        disabled={pending || selectedCount === 0}
        onClick={handleAdd}
        className="self-start rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50"
      >
        {pending ? 'Agregando…' : `Agregar ${selectedCount} seleccionado${selectedCount === 1 ? '' : 's'} a candidatos`}
      </button>
    </div>
  );
}

export function EventLinkImporter() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [events, setEvents] = useState<ExtractedEventWithDuplicate[] | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFetch = () => {
    if (!url.trim()) return;
    setError('');
    setDone(false);
    setEvents(null);
    setLoading(true);
    startTransition(async () => {
      const res = await extractEventFromLink(url.trim());
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else if (res.events) {
        setEvents(res.events);
      }
    });
  };

  const reset = () => {
    setEvents(null);
    setError('');
    setDone(false);
    setUrl('');
  };

  // Single event (the common case — a normal event page) reuses the exact
  // same preview/edit/approve UI as the image importer.
  const singleEvent = events && events.length === 1 ? events[0] : null;
  const [singleExtracted, setSingleExtracted] = useState<ExtractedEvent | null>(null);
  const singleDuplicate: DuplicateMatch | null = singleEvent?.duplicate ?? null;

  return (
    <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4">
      <p className="mb-2 text-sm font-medium">Agregar evento(s) desde link</p>
      <p className="mb-3 text-xs text-gray-500">
        Pega la URL de la página de un evento específico, o de un listado/cartelera completo de una
        boletera (ej. la página de &quot;Conciertos&quot; de un sitio de boletos). Se lee esa página puntual una
        sola vez — no es un buscador ni recorre el sitio ni pagina automáticamente. Si la página
        requiere login o es una app que no muestra contenido sin JavaScript, te lo avisamos para que
        completes el formulario a mano.
      </p>

      {!events && (
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

      {singleEvent && !done && (
        <ExtractedEventPreview
          extracted={singleExtracted ?? singleEvent}
          duplicate={singleDuplicate}
          source="link"
          onChange={setSingleExtracted}
          onDone={() => setDone(true)}
          onCancel={reset}
        />
      )}

      {events && events.length > 1 && !done && <MultiEventPicker events={events} onDone={() => setDone(true)} />}
    </div>
  );
}
