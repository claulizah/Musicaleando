'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { resolveEstado, OTRO_ESTADO_LABEL } from '@/lib/mexicoEstados';
import { categorizeEvent, CATEGORY_LABEL, type EventCategory } from '@/lib/eventCategory';
import { dateBucketFor, DATE_BUCKET_LABEL, DATE_BUCKET_ORDER } from '@/lib/dateBuckets';
import { csvFilename, downloadCsvAsync } from '@/lib/csvExport';

type Festival = {
  id: string;
  nombre: string;
  tipo: string;
  ciudad: string;
  fecha_inicio: string;
  fecha_fin: string;
  link_boletos: string | null;
  estado_evento: string;
  venue_id: string | null;
};

type EstadoFilter = 'activo' | 'archivado';

type GroupBy = 'evento' | 'artista' | 'estado' | 'lugar' | 'categoria' | 'fecha';

const SIN_LUGAR_LABEL = '(sin lugar)';

const SOURCE_LABEL: Record<string, string> = {
  ticketmaster: 'Ticketmaster',
  eticket: 'eticket.mx',
  superboletos: 'Superboletos',
  poster_image: 'Póster (admin)',
  sumision_publica: 'Sumisión pública',
  link: 'Link',
  carga_inicial: 'Carga inicial',
};

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function FestivalRow({ festival, venueName }: { festival: Festival; venueName?: string }) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <Link href={`/festivals/${festival.id}`} className="font-medium underline">
        {festival.nombre}
      </Link>
      {festival.estado_evento === 'archivado' && (
        <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Archivado</span>
      )}
      <p className="text-sm text-gray-500">
        {festival.ciudad}
        {venueName && ` · ${venueName}`} · {festival.fecha_inicio} → {festival.fecha_fin}
      </p>
      <p className="text-xs text-gray-400">{festival.link_boletos ? festival.link_boletos : 'Sin link de boletos'}</p>
    </li>
  );
}

function GroupSection({ label, festivals, defaultOpen, venueNameById }: { label: string; festivals: Festival[]; defaultOpen: boolean; venueNameById: Record<string, string> }) {
  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700">
        {label} <span className="text-gray-400">({festivals.length})</span>
      </summary>
      <ul className="flex flex-col gap-3 p-3 pt-0">
        {festivals.map((f) => (
          <FestivalRow key={f.id} festival={f} venueName={f.venue_id ? venueNameById[f.venue_id] : undefined} />
        ))}
      </ul>
    </details>
  );
}

export function FestivalesList({
  festivals,
  lineupByFestival = {},
  venueNameById = {},
  sourceByFestival = {},
}: {
  festivals: Festival[];
  lineupByFestival?: Record<string, string[]>;
  venueNameById?: Record<string, string>;
  sourceByFestival?: Record<string, string>;
}) {
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('evento');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | null>(null);
  // Activos por default (lo que ve la app); Archivados = historial de eventos
  // ya vencidos, que no se borran para poder consultarlos y reutilizarlos.
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('activo');

  const estadoCounts = useMemo(() => {
    let archivado = 0;
    for (const f of festivals) if (f.estado_evento === 'archivado') archivado++;
    return { activo: festivals.length - archivado, archivado };
  }, [festivals]);

  const scoped = useMemo(
    () => festivals.filter((f) => (estadoFilter === 'archivado') === (f.estado_evento === 'archivado')),
    [festivals, estadoFilter],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<EventCategory, number>();
    for (const f of scoped) {
      const cat = categorizeEvent(f);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    return scoped.filter((f) => {
      if (categoryFilter && categorizeEvent(f) !== categoryFilter) return false;
      if (!q) return true;
      const artistas = lineupByFestival[f.id] ?? [];
      const haystack = normalizeText([f.nombre, f.ciudad, ...artistas].join(' | '));
      return haystack.includes(q);
    });
  }, [scoped, lineupByFestival, query, categoryFilter]);

  // Exporta exactamente lo que está filtrado en pantalla (búsqueda + tipo de
  // categoría + activo/archivado) — mismo criterio que /candidatos.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const headers = ['nombre', 'fecha_inicio', 'fecha_fin', 'ciudad', 'estado', 'lugar', 'categoria', 'fuente', 'artistas'];
      const rows = filtered.map((f) => {
        const artistas = lineupByFestival[f.id] ?? [];
        return [
          f.nombre,
          f.fecha_inicio,
          f.fecha_fin,
          f.ciudad,
          resolveEstado(f.ciudad),
          (f.venue_id && venueNameById[f.venue_id]) || '',
          CATEGORY_LABEL[categorizeEvent(f)],
          SOURCE_LABEL[sourceByFestival[f.id] ?? ''] ?? sourceByFestival[f.id] ?? '',
          artistas.join(', '),
        ];
      });
      await downloadCsvAsync(csvFilename('catalogo'), headers, rows);
    } finally {
      setExporting(false);
    }
  };

  const groups = useMemo(() => {
    if (groupBy === 'evento') return [{ key: '__all__', label: null as string | null, items: filtered }];
    if (groupBy === 'categoria') {
      const map = new Map<EventCategory, Festival[]>();
      for (const f of filtered) {
        const key = categorizeEvent(f);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(f);
      }
      return [...map.entries()].map(([key, items]) => ({ key, label: CATEGORY_LABEL[key], items }));
    }
    if (groupBy === 'fecha') {
      const map = new Map<string, Festival[]>();
      for (const f of filtered) {
        const key = dateBucketFor(f.fecha_inicio);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(f);
      }
      return DATE_BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({ key: b, label: DATE_BUCKET_LABEL[b], items: map.get(b)! }));
    }
    if (groupBy === 'lugar') {
      const map = new Map<string, { label: string; items: Festival[] }>();
      for (const f of filtered) {
        const label = (f.venue_id && venueNameById[f.venue_id]) || SIN_LUGAR_LABEL;
        const key = f.venue_id ?? SIN_LUGAR_LABEL;
        if (!map.has(key)) map.set(key, { label, items: [] });
        map.get(key)!.items.push(f);
      }
      return [...map.entries()]
        .map(([key, { label, items }]) => ({ key, label, items }))
        .sort((a, b) => {
          if (a.label === SIN_LUGAR_LABEL) return 1;
          if (b.label === SIN_LUGAR_LABEL) return -1;
          return a.label.localeCompare(b.label);
        });
    }
    const map = new Map<string, { label: string; items: Festival[] }>();
    for (const f of filtered) {
      const key = groupBy === 'artista' ? normalizeText(f.nombre) : resolveEstado(f.ciudad);
      const label = groupBy === 'artista' ? f.nombre : resolveEstado(f.ciudad);
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(f);
    }
    return [...map.entries()]
      .map(([key, { label, items }]) => ({ key, label, items }))
      .sort((a, b) => {
        if (a.label === OTRO_ESTADO_LABEL) return 1;
        if (b.label === OTRO_ESTADO_LABEL) return -1;
        return (a.label ?? '').localeCompare(b.label ?? '');
      });
  }, [filtered, groupBy, venueNameById]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, ciudad o artista…"
          className="min-w-[16rem] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
        >
          {exporting ? 'Generando…' : `⬇ Exportar CSV (${filtered.length})`}
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Agrupar:</span>
          {(
            [
              { id: 'evento', label: 'Por evento' },
              { id: 'artista', label: 'Por artista' },
              { id: 'estado', label: 'Por estado' },
              { id: 'lugar', label: 'Por lugar' },
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
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Estado:</span>
        {(
          [
            { id: 'activo', label: 'Activos' },
            { id: 'archivado', label: 'Archivados (historial)' },
          ] as { id: EstadoFilter; label: string }[]
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setEstadoFilter(opt.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              estadoFilter === opt.id ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {opt.label} ({estadoCounts[opt.id]})
          </button>
        ))}
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
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3 py-1 text-xs ${
                categoryFilter === cat ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {CATEGORY_LABEL[cat]} ({categoryCounts.get(cat)})
            </button>
          ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-500">
          {festivals.length === 0
            ? 'No hay festivales todavía.'
            : scoped.length === 0
              ? estadoFilter === 'archivado'
                ? 'Todavía no hay eventos archivados — se archivan solos cuando pasa su fecha de fin.'
                : 'No hay eventos activos.'
              : 'Nada coincide con esa búsqueda.'}
        </p>
      )}

      {groupBy === 'evento' ? (
        <ul className="flex flex-col gap-3">
          {filtered.map((f) => (
            <FestivalRow key={f.id} festival={f} venueName={f.venue_id ? venueNameById[f.venue_id] : undefined} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g) => (
            <GroupSection
              key={g.key}
              label={g.label ?? ''}
              festivals={g.items}
              defaultOpen={groups.length <= 5}
              venueNameById={venueNameById}
            />
          ))}
        </div>
      )}
    </div>
  );
}
