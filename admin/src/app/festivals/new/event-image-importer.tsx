'use client';

import { useRef, useState, useTransition } from 'react';
import {
  extractEventFromImage,
  createEventCandidateFromImage,
  mergeLineupIntoExisting,
  type ExtractedEvent,
  type DuplicateMatch,
} from '../../candidatos/actions';

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.slice(result.indexOf(',') + 1);
      resolve({ base64, mediaType: file.type || 'image/png' });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function EventImageImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedEvent | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError('');
    setDone(false);
    setExtracted(null);
    setDuplicate(null);
    setUploading(true);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await extractEventFromImage(base64, mediaType);
      if (res.error) {
        setError(res.error);
      } else if (res.extracted) {
        setExtracted(res.extracted);
        setDuplicate(res.duplicate ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la imagen.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const updateField = <K extends keyof ExtractedEvent>(key: K, value: ExtractedEvent[K]) => {
    setExtracted((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleCreateNew = () => {
    if (!extracted) return;
    setError('');
    startTransition(async () => {
      const res = await createEventCandidateFromImage(extracted);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  };

  const handleMerge = () => {
    if (!extracted || !duplicate) return;
    setError('');
    startTransition(async () => {
      const res = await mergeLineupIntoExisting(duplicate, extracted.lineup);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  };

  const reset = () => {
    setExtracted(null);
    setDuplicate(null);
    setError('');
    setDone(false);
  };

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-4">
      <p className="mb-2 text-sm font-medium">Agregar evento desde imagen</p>
      <p className="mb-3 text-xs text-gray-500">
        Sube la foto de un póster, flyer o line-up. La IA extrae nombre, tipo, fecha, ciudad/venue y
        el line-up — nada se publica al catálogo: se agrega a <strong>/candidatos</strong> para que lo
        revises y apruebes ahí, igual que los eventos de Ticketmaster. Si la imagen no se puede leer
        bien, usa el formulario de arriba a mano.
      </p>

      {!extracted && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="text-sm"
        />
      )}
      {uploading && <p className="mt-2 text-sm text-gray-500">Extrayendo con IA…</p>}
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
        <div className="mt-4 flex flex-col gap-3 rounded-md bg-gray-50 p-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 flex flex-col gap-1">
              Nombre
              <input
                className="rounded border border-gray-300 px-2 py-1"
                value={extracted.nombre ?? ''}
                onChange={(e) => updateField('nombre', e.target.value || null)}
              />
            </label>
            <label className="flex flex-col gap-1">
              Tipo
              <select
                className="rounded border border-gray-300 px-2 py-1"
                value={extracted.tipo ?? ''}
                onChange={(e) =>
                  updateField('tipo', (e.target.value || null) as ExtractedEvent['tipo'])
                }
              >
                <option value="">Sin confirmar (la IA no estuvo segura)</option>
                <option value="festival">Festival</option>
                <option value="concierto">Concierto</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Ciudad
              <input
                className="rounded border border-gray-300 px-2 py-1"
                value={extracted.ciudad ?? ''}
                onChange={(e) => updateField('ciudad', e.target.value || null)}
              />
            </label>
            <label className="flex flex-col gap-1">
              Venue
              <input
                className="rounded border border-gray-300 px-2 py-1"
                value={extracted.venue ?? ''}
                onChange={(e) => updateField('venue', e.target.value || null)}
              />
            </label>
            <label className="flex flex-col gap-1">
              Fecha inicio
              <input
                type="date"
                className="rounded border border-gray-300 px-2 py-1"
                value={extracted.fecha_inicio ?? ''}
                onChange={(e) => updateField('fecha_inicio', e.target.value || null)}
              />
            </label>
            <label className="flex flex-col gap-1">
              Fecha fin (opcional)
              <input
                type="date"
                className="rounded border border-gray-300 px-2 py-1"
                value={extracted.fecha_fin ?? ''}
                onChange={(e) => updateField('fecha_fin', e.target.value || null)}
              />
            </label>
          </div>

          {extracted.lineup.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-600">Line-up extraído ({extracted.lineup.length})</p>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-gray-500">
                {extracted.lineup.map((l, i) => (
                  <li key={i}>
                    {l.artista}
                    {l.escenario ? ` · ${l.escenario}` : ''}
                    {l.horario ? ` · ${l.horario}` : ''}
                  </li>
                ))}
              </ul>
              {!extracted.esHorarioConTiempos && (
                <p className="mt-1 text-xs text-gray-400">
                  El póster no traía horarios legibles — solo se extrajeron nombres de artistas.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No se detectó ningún line-up en la imagen.</p>
          )}

          {duplicate && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Ya existe algo parecido:{' '}
              <strong>
                {duplicate.nombre} ({duplicate.type === 'festival' ? 'festival aprobado' : 'candidato pendiente'})
              </strong>
              . ¿Actualizas su line-up en vez de crear un evento nuevo?
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {duplicate && (
              <button
                type="button"
                disabled={pending}
                onClick={handleMerge}
                className="rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50"
              >
                Actualizar line-up del existente
              </button>
            )}
            <button
              type="button"
              disabled={pending || !extracted.nombre}
              onClick={handleCreateNew}
              className={
                duplicate
                  ? 'text-xs text-gray-600 underline disabled:opacity-50'
                  : 'rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50'
              }
            >
              {duplicate ? 'Crear como nuevo de todas formas' : 'Agregar a candidatos'}
            </button>
            <button type="button" onClick={reset} className="text-xs text-gray-500 underline">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
