'use client';

import { useTransition } from 'react';
import {
  createEventCandidate,
  mergeLineupIntoExisting,
  type ExtractedEvent,
} from '../../candidatos/actions';
import type { DuplicateMatch } from '@/lib/candidateDuplicates';

// Shared by EventImageImporter and EventLinkImporter — both produce the same
// ExtractedEvent + optional DuplicateMatch shape, so the preview/edit/
// approve UI (and the dedup-aware "update existing instead of creating a
// duplicate" choice) only needs to exist once.
export function ExtractedEventPreview({
  extracted,
  duplicate,
  source,
  onChange,
  onDone,
  onCancel,
}: {
  extracted: ExtractedEvent;
  duplicate: DuplicateMatch | null;
  source: 'poster_image' | 'link';
  onChange: (next: ExtractedEvent) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  // 'archivado' es solo una pista (mismo nombre, otra fecha): no ofrece
  // "actualizar el existente" ni relega el botón de crear a segundo plano.
  const blockingDuplicate = duplicate && duplicate.type !== 'archivado' ? duplicate : null;

  const updateField = <K extends keyof ExtractedEvent>(key: K, value: ExtractedEvent[K]) => {
    onChange({ ...extracted, [key]: value });
  };

  const handleCreateNew = () => {
    startTransition(async () => {
      const res = await createEventCandidate(extracted, source, duplicate);
      if (!res.error) onDone();
    });
  };

  const handleMerge = () => {
    if (!blockingDuplicate) return;
    startTransition(async () => {
      const res = await mergeLineupIntoExisting(blockingDuplicate, extracted.lineup);
      if (!res.error) onDone();
    });
  };

  return (
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
            onChange={(e) => updateField('tipo', (e.target.value || null) as ExtractedEvent['tipo'])}
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
            <p className="mt-1 text-xs text-gray-400">No se detectaron horarios legibles — solo nombres de artistas.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No se detectó ningún line-up.</p>
      )}

      {duplicate?.type === 'archivado' && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Ya hubo un evento archivado con este mismo nombre:{' '}
          <strong>
            {duplicate.nombre}
            {duplicate.fecha_inicio ? ` (${duplicate.fecha_inicio})` : ''}
          </strong>
          . Probablemente es un re-anuncio — se puede crear como evento nuevo.
        </div>
      )}
      {blockingDuplicate && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ya existe algo parecido:{' '}
          <strong>
            {blockingDuplicate.nombre} ({blockingDuplicate.type === 'festival' ? 'festival aprobado' : 'candidato pendiente'})
          </strong>
          . ¿Actualizas su line-up en vez de crear un evento nuevo?
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {blockingDuplicate && (
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
            blockingDuplicate
              ? 'text-xs text-gray-600 underline disabled:opacity-50'
              : 'rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50'
          }
        >
          {blockingDuplicate ? 'Crear como nuevo de todas formas' : 'Agregar a candidatos'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-gray-500 underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
