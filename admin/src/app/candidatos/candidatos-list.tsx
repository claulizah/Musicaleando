'use client';

import { useMemo, useState, useTransition } from 'react';
import { CandidateActions } from './candidate-actions';
import {
  approveCandidatesBulk,
  discardCandidatesBulk,
  undoApproveBulk,
  undoDiscardBulk,
  type BulkApproveResult,
  type BulkRejectResult,
} from './actions';
import { UndoToast } from './undo-toast';
import { resolveEstado, OTRO_ESTADO_LABEL } from '@/lib/mexicoEstados';
import { cleanEventNameSafe } from '@/lib/cleanEventName';
import { categorizeEvent, CATEGORY_LABEL, type EventCategory } from '@/lib/eventCategory';
import { dateBucketFor, DATE_BUCKET_LABEL, DATE_BUCKET_ORDER } from '@/lib/dateBuckets';
import { groupLineupByDay } from '@/lib/lineupByDay';
import type { Database } from '@/lib/database.types';

type Candidate = Database['public']['Tables']['event_candidates']['Row'];

const SOURCE_LABEL: Record<string, string> = {
  ticketmaster: 'Ticketmaster',
  poster_image: '📷 Póster (admin)',
  sumision_publica: '🌐 Sumisión pública',
  link: '🔗 Link',
  carga_inicial: '📦 Carga inicial',
};

const TIPO_LABEL: Record<string, string> = {
  festival: '🎪 Festival',
  concierto: '🎤 Concierto',
};

type GroupBy = 'evento' | 'artista' | 'estado' | 'categoria' | 'fecha';

function formatLineupItem(item: string | { artista: string; escenario: string | null; horario: string | null }): string {
  if (typeof item === 'string') return item;
  const parts = [item.artista];
  if (item.escenario) parts.push(item.escenario);
  if (item.horario) parts.push(item.horario);
  return parts.join(' · ');
}

function lineupArtistNames(lineup: Candidate['lineup']): string[] {
  if (!Array.isArray(lineup)) return [];
  return lineup.map((item) => (typeof item === 'string' ? item : item.artista));
}

// Checklist visual simple de campos esperados para un evento publicable —
// no es detección de "candidato sospechoso", solo lo que hoy es obligatorio
// (ciudad, fecha_inicio, link_boletos si la fuente es ticketmaster) o
// esperado (alguna hora en el line-up, póster cuando la fuente es imagen).
// No incluye "género": no existe ningún campo de género por evento en el
// esquema (Ticketmaster no lo trae, tampoco hay mapeo artista→género — ver
// prompt-siguiente-filtros-catalogo-eventos.md) y mostrarlo siempre como
// "falta" sería ruido, no señal real.
function missingFields(candidate: Candidate): string[] {
  const missing: string[] = [];
  if (!candidate.ciudad) missing.push('ciudad');
  if (!candidate.fecha_inicio) missing.push('fecha');
  if (candidate.source === 'ticketmaster' && !candidate.link_boletos) missing.push('boletos');
  const lineup = Array.isArray(candidate.lineup) ? candidate.lineup : [];
  const tieneHora = lineup.some((item) => typeof item !== 'string' && Boolean(item.horario));
  if (lineup.length > 0 && !tieneHora) missing.push('hora');
  if (candidate.source === 'poster_image' && !rawPayloadExtras(candidate.raw_payload).posterUrl) {
    missing.push('poster');
  }
  return missing;
}

function rawPayloadExtras(raw: unknown): { submittedLink: string | null; posterUrl: string | null } {
  if (!raw || typeof raw !== 'object') return { submittedLink: null, posterUrl: null };
  const obj = raw as Record<string, unknown>;
  return {
    submittedLink: typeof obj.submitted_link === 'string' ? obj.submitted_link : null,
    posterUrl: typeof obj.poster_url === 'string' ? obj.poster_url : null,
  };
}

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// A partir de este tamaño de lote, un confirm() simple ya no es suficiente
// fricción — "seleccionar todos visibles" o por categoría hace fácil
// seleccionar cientos por accidente. 50 es el umbral: por debajo, el
// confirm() de siempre; por arriba, hay que escribir el número exacto de
// candidatos afectados (un segundo paso deliberado, no solo un click más).
const BULK_CONFIRM_THRESHOLD = 50;

function confirmBulkAction(count: number, verbo: string, sustantivo: string): boolean {
  if (count > BULK_CONFIRM_THRESHOLD) {
    const typed = prompt(
      `Vas a ${verbo} ${count} ${sustantivo}. Es un lote grande — escribe "${count}" para confirmar.`,
    );
    return typed?.trim() === String(count);
  }
  return confirm(`Vas a ${verbo} ${count} ${sustantivo}. ¿Confirmas?`);
}

// "Por artista": el nombre del candidato ya ES el artista para un concierto
// de un solo acto (así quedaron los 90 de la carga de Eticket — un
// idartista por página), y para un festival agrupa ediciones repetidas del
// mismo nombre. No explota candidatos multi-artista en varias membresías —
// cada candidato pertenece a un solo grupo, el de su propio nombre.
function artistGroupKey(c: Candidate): string {
  return normalizeText(c.nombre || '(sin nombre)');
}

function CandidateCard({
  candidate,
  duplicateName,
  selected,
  onToggleSelect,
}: {
  candidate: Candidate;
  duplicateName: string | null | undefined;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const { submittedLink, posterUrl } = rawPayloadExtras(candidate.raw_payload);
  const missing = missingFields(candidate);
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={selected}
            onChange={() => onToggleSelect(candidate.id)}
            aria-label={`Seleccionar ${candidate.nombre}`}
          />
          <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{candidate.nombre}</p>
            {candidate.tipo && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {TIPO_LABEL[candidate.tipo] ?? candidate.tipo}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {candidate.ciudad ?? 'Sin ciudad'} · {candidate.fecha_inicio ?? 'Sin fecha'}
            {candidate.venue ? ` · ${candidate.venue}` : ''}
          </p>
          <p className="text-xs text-gray-400">Fuente: {SOURCE_LABEL[candidate.source] ?? candidate.source}</p>
          {posterUrl && (
            <a href={posterUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
              Ver póster adjunto
            </a>
          )}
          {submittedLink && (
            <p className="text-xs text-gray-400">
              Link de la fuente:{' '}
              <a href={submittedLink} target="_blank" rel="noreferrer" className="underline">
                {submittedLink}
              </a>
            </p>
          )}
          {candidate.price_min != null && (
            <p className="text-xs text-gray-400">
              Desde {candidate.price_min} {candidate.price_currency ?? ''}
              {candidate.price_max != null ? ` hasta ${candidate.price_max}` : ''}
            </p>
          )}
          {(() => {
            const lineup = Array.isArray(candidate.lineup) ? candidate.lineup : [];
            if (lineup.length === 0) return null;
            const normalized = lineup.map((item) =>
              typeof item === 'string' ? { artista: item, escenario: null, horario: null } : item,
            );
            const byDay = groupLineupByDay(normalized, candidate.fecha_inicio, candidate.fecha_fin);
            // Multi-día: se agrupa por fecha para que revisar un line-up
            // largo (ej. un festival de 3 días) no sea una sola tira de
            // texto. Un candidato de un solo día no cambia su presentación.
            if (byDay) {
              return (
                <div className="mt-1 flex flex-col gap-1">
                  {byDay.map((group) => (
                    <details key={group.day ?? 'sin-dia'} className="text-xs text-gray-500">
                      <summary className="cursor-pointer select-none">
                        {group.label} ({group.items.length})
                      </summary>
                      <p className="pl-3">{group.items.map(formatLineupItem).join(', ')}</p>
                    </details>
                  ))}
                </div>
              );
            }
            return (
              <p className="mt-1 text-xs text-gray-500">
                Line-up: {lineup.slice(0, 6).map(formatLineupItem).join(', ')}
                {lineup.length > 6 ? '…' : ''}
              </p>
            );
          })()}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              candidate.completo ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {candidate.completo ? 'Completo' : 'Incompleto'}
          </span>
          {missing.length > 0 && (
            <span className="max-w-[10rem] text-right text-xs text-amber-700">falta: {missing.join(', ')}</span>
          )}
          {candidate.link_boletos && (
            <a href={candidate.link_boletos} target="_blank" rel="noreferrer" className="text-xs underline">
              Ver boletos
            </a>
          )}
        </div>
      </div>

      {duplicateName && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ Posible duplicado de: <strong>{duplicateName}</strong>. Revisa antes de aprobar — no se fusiona
          automáticamente.
        </p>
      )}

      <CandidateActions
        candidateId={candidate.id}
        completo={candidate.completo}
        defaults={{
          nombre: cleanEventNameSafe(candidate.nombre),
          tipo: candidate.tipo ?? '',
          ciudad: candidate.ciudad ?? '',
          fecha_inicio: candidate.fecha_inicio ?? '',
          fecha_fin: candidate.fecha_fin ?? '',
          link_boletos: candidate.link_boletos ?? '',
        }}
      />
    </li>
  );
}

function GroupSection({
  label,
  candidates,
  festivalNameById,
  defaultOpen,
  selectedIds,
  onToggleSelect,
}: {
  label: string;
  candidates: Candidate[];
  festivalNameById: Map<string, string>;
  defaultOpen: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700">
        {label} <span className="text-gray-400">({candidates.length})</span>
      </summary>
      <ul className="flex flex-col gap-3 p-3 pt-0">
        {candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            duplicateName={c.possible_duplicate_of ? festivalNameById.get(c.possible_duplicate_of) : null}
            selected={selectedIds.has(c.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </ul>
    </details>
  );
}

export function CandidatosList({
  candidates,
  festivalNameById,
}: {
  candidates: Candidate[];
  festivalNameById: Map<string, string>;
}) {
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('evento');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResults, setBulkResults] = useState<
    { kind: 'approve'; results: BulkApproveResult[] } | { kind: 'reject'; results: BulkRejectResult[] } | null
  >(null);
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkUndo, setBulkUndo] = useState<{ kind: 'approve' | 'reject'; ids: string[] } | null>(null);
  const [bulkUndoPending, startBulkUndoTransition] = useTransition();

  // Filtro por fuente de origen — opciones sacadas de los valores reales
  // presentes en los candidatos, no de una lista fija (una fuente que hoy no
  // tenga pendientes no aparece como chip vacío).
  const sourceOptions = useMemo(() => {
    return [...new Set(candidates.map((c) => c.source))].sort();
  }, [candidates]);

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    return candidates.filter((c) => {
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (categoryFilter && categorizeEvent(c) !== categoryFilter) return false;
      if (!q) return true;
      const haystack = [c.nombre, c.ciudad, c.venue, ...lineupArtistNames(c.lineup)]
        .filter((v): v is string => Boolean(v))
        .map(normalizeText)
        .join(' | ');
      return haystack.includes(q);
    });
  }, [candidates, query, sourceFilter, categoryFilter]);

  // Conteo real por categoría sobre lo ya filtrado por texto/fuente — sirve
  // tanto para los chips del filtro como para saber cuántos entrarían al
  // "seleccionar todos" de una categoría antes de hacer clic.
  const categoryCounts = useMemo(() => {
    const counts = new Map<EventCategory, number>();
    for (const c of candidates) {
      const cat = categorizeEvent(c);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [candidates]);

  const groups = useMemo(() => {
    if (groupBy === 'evento') {
      return [{ key: '__all__', label: null as string | null, items: filtered }];
    }
    if (groupBy === 'categoria') {
      const map = new Map<EventCategory, Candidate[]>();
      for (const c of filtered) {
        const key = categorizeEvent(c);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      }
      return [...map.entries()].map(([key, items]) => ({ key, label: CATEGORY_LABEL[key], items }));
    }
    if (groupBy === 'fecha') {
      const map = new Map<string, Candidate[]>();
      for (const c of filtered) {
        const key = dateBucketFor(c.fecha_inicio);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      }
      return DATE_BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({
        key: b,
        label: DATE_BUCKET_LABEL[b],
        items: map.get(b)!,
      }));
    }
    const map = new Map<string, { label: string; items: Candidate[] }>();
    for (const c of filtered) {
      const key = groupBy === 'artista' ? artistGroupKey(c) : resolveEstado(c.ciudad);
      const label = groupBy === 'artista' ? c.nombre || '(sin nombre)' : resolveEstado(c.ciudad);
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(c);
    }
    return [...map.entries()]
      .map(([key, { label, items }]) => ({ key, label, items }))
      .sort((a, b) => {
        // "Otro / sin estado" siempre al final, el resto alfabético.
        if (a.label === OTRO_ESTADO_LABEL) return 1;
        if (b.label === OTRO_ESTADO_LABEL) return -1;
        return (a.label ?? '').localeCompare(b.label ?? '');
      });
  }, [filtered, groupBy]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // "Posibles duplicados" quedan fuera de "Seleccionar todos" por default —
  // mismo criterio de seguridad que el importador de listados (agregar
  // desde link): la curadora los marca a mano si de verdad quiere aprobarlos.
  const selectAllVisible = () => {
    setSelectedIds(new Set(filtered.filter((c) => !c.possible_duplicate_of).map((c) => c.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Selección rápida en bulk por categoría — un clic reemplaza la selección
  // por todos los candidatos de esa categoría (respeta la misma exclusión de
  // posibles duplicados que "Seleccionar todos visibles"), independiente del
  // filtro de texto/fuente activo en ese momento.
  const selectAllInCategory = (cat: EventCategory) => {
    setSelectedIds(new Set(candidates.filter((c) => categorizeEvent(c) === cat && !c.possible_duplicate_of).map((c) => c.id)));
  };

  const handleBulkApprove = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!confirmBulkAction(ids.length, 'aprobar', 'evento(s) y se publicarán en el catálogo')) return;
    setBulkResults(null);
    setBulkUndo(null);
    startBulkTransition(async () => {
      const { results } = await approveCandidatesBulk(ids);
      setBulkResults({ kind: 'approve', results });
      // Solo se quitan de la selección los que sí se aprobaron — los que
      // fallaron quedan marcados para que sea obvio cuáles todavía necesitan
      // atención (completar datos a mano, etc.).
      const succeededIds = results.filter((r) => !r.error).map((r) => r.id);
      setSelectedIds((prev) => new Set([...prev].filter((id) => !succeededIds.includes(id))));
      if (succeededIds.length > 0) setBulkUndo({ kind: 'approve', ids: succeededIds });
    });
  };

  const handleBulkReject = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!confirmBulkAction(ids.length, 'rechazar', 'candidato(s)')) return;
    setBulkResults(null);
    setBulkUndo(null);
    startBulkTransition(async () => {
      const { results } = await discardCandidatesBulk(ids);
      setBulkResults({ kind: 'reject', results });
      const succeededIds = results.filter((r) => !r.error).map((r) => r.id);
      setSelectedIds((prev) => new Set([...prev].filter((id) => !succeededIds.includes(id))));
      if (succeededIds.length > 0) setBulkUndo({ kind: 'reject', ids: succeededIds });
    });
  };

  // El deshacer en bulk revierte el LOTE completo de la última acción, no
  // ítem por ítem — mismo alcance que documenta undoApprove del lado del
  // servidor (borra festival_lineup + festivals creados, nunca los artists).
  const handleBulkUndo = () => {
    if (!bulkUndo) return;
    startBulkUndoTransition(async () => {
      if (bulkUndo.kind === 'approve') {
        await undoApproveBulk(bulkUndo.ids);
      } else {
        await undoDiscardBulk(bulkUndo.ids);
      }
      setBulkUndo(null);
      setBulkResults(null);
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, ciudad, venue o artista…"
          className="min-w-[16rem] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Agrupar:</span>
          {(
            [
              { id: 'evento', label: 'Por evento' },
              { id: 'artista', label: 'Por artista' },
              { id: 'estado', label: 'Por estado' },
              { id: 'categoria', label: 'Por categoría' },
              { id: 'fecha', label: 'Por fecha' },
            ] as { id: GroupBy; label: string }[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setGroupBy(opt.id)}
              className={`rounded-full px-3 py-1 text-xs ${
                groupBy === opt.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {sourceOptions.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Fuente:</span>
            <button
              type="button"
              onClick={() => setSourceFilter(null)}
              className={`rounded-full px-3 py-1 text-xs ${
                sourceFilter === null ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Todas
            </button>
            {sourceOptions.map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setSourceFilter(source)}
                className={`rounded-full px-3 py-1 text-xs ${
                  sourceFilter === source ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {SOURCE_LABEL[source] ?? source}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Categoría:</span>
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={`rounded-full px-3 py-1 text-xs ${
            categoryFilter === null ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Todas
        </button>
        {(Object.keys(CATEGORY_LABEL) as EventCategory[])
          .filter((cat) => (categoryCounts.get(cat) ?? 0) > 0)
          .map((cat) => (
            <span key={cat} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full px-3 py-1 text-xs ${
                  categoryFilter === cat ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {CATEGORY_LABEL[cat]} ({categoryCounts.get(cat)})
              </button>
              <button
                type="button"
                title={`Seleccionar todos los de ${CATEGORY_LABEL[cat]}`}
                onClick={() => selectAllInCategory(cat)}
                className="rounded-full border border-gray-300 px-1.5 py-0.5 text-xs text-gray-500"
              >
                ☑
              </button>
            </span>
          ))}
      </div>

      {filtered.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm">
          <button type="button" onClick={selectAllVisible} className="underline">
            Seleccionar todos visibles
          </button>
          {selectedIds.size > 0 && (
            <button type="button" onClick={clearSelection} className="text-gray-500 underline">
              Quitar selección
            </button>
          )}
          <span className="text-gray-500">{selectedIds.size} seleccionado(s)</span>
          <button
            type="button"
            disabled={selectedIds.size === 0 || bulkPending}
            onClick={handleBulkReject}
            className="ml-auto rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 disabled:opacity-50"
          >
            {bulkPending ? 'Procesando…' : `Rechazar ${selectedIds.size} seleccionado(s)`}
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0 || bulkPending}
            onClick={handleBulkApprove}
            className="rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {bulkPending ? 'Procesando…' : `Aprobar ${selectedIds.size} seleccionado(s)`}
          </button>
        </div>
      )}

      {bulkResults && (
        <div className="mb-4 rounded-md border border-gray-200 bg-white p-3 text-xs">
          <p className="mb-1 font-medium text-gray-700">
            Resultado: {bulkResults.results.filter((r) => !r.error).length}{' '}
            {bulkResults.kind === 'approve' ? 'aprobado(s)' : 'rechazado(s)'},{' '}
            {bulkResults.results.filter((r) => r.error).length} con error.
          </p>
          <ul className="flex flex-col gap-1">
            {bulkResults.results.map((r) => (
              <li key={r.id} className={r.error ? 'text-red-600' : 'text-green-700'}>
                {r.error ? '✗' : '✓'} {r.nombre}
                {r.error ? `: ${r.error}` : ''}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setBulkResults(null)} className="mt-2 text-gray-500 underline">
            Cerrar
          </button>
        </div>
      )}

      {bulkUndo && (
        <UndoToast
          message={
            bulkUndo.kind === 'approve'
              ? `${bulkUndo.ids.length} aprobado(s).`
              : `${bulkUndo.ids.length} rechazado(s).`
          }
          onUndo={handleBulkUndo}
          onExpire={() => setBulkUndo(null)}
          pending={bulkUndoPending}
        />
      )}

      {filtered.length === 0 && (
        <p className="text-sm text-gray-500">
          {candidates.length === 0 ? 'No hay candidatos pendientes.' : 'Nada coincide con esa búsqueda.'}
        </p>
      )}

      {groupBy === 'evento' ? (
        <ul className="flex flex-col gap-3">
          {filtered.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              duplicateName={c.possible_duplicate_of ? festivalNameById.get(c.possible_duplicate_of) : null}
              selected={selectedIds.has(c.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g) => (
            <GroupSection
              key={g.key}
              label={g.label ?? ''}
              candidates={g.items}
              festivalNameById={festivalNameById}
              defaultOpen={groups.length <= 5}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
