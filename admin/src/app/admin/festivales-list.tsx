'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { resolveEstado, OTRO_ESTADO_LABEL } from '@/lib/mexicoEstados';

type Festival = {
  id: string;
  nombre: string;
  ciudad: string;
  fecha_inicio: string;
  fecha_fin: string;
  link_boletos: string | null;
};

type GroupBy = 'evento' | 'artista' | 'estado';

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function FestivalRow({ festival }: { festival: Festival }) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <Link href={`/festivals/${festival.id}`} className="font-medium underline">
        {festival.nombre}
      </Link>
      <p className="text-sm text-gray-500">
        {festival.ciudad} · {festival.fecha_inicio} → {festival.fecha_fin}
      </p>
      <p className="text-xs text-gray-400">{festival.link_boletos ? festival.link_boletos : 'Sin link de boletos'}</p>
    </li>
  );
}

function GroupSection({ label, festivals, defaultOpen }: { label: string; festivals: Festival[]; defaultOpen: boolean }) {
  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-700">
        {label} <span className="text-gray-400">({festivals.length})</span>
      </summary>
      <ul className="flex flex-col gap-3 p-3 pt-0">
        {festivals.map((f) => (
          <FestivalRow key={f.id} festival={f} />
        ))}
      </ul>
    </details>
  );
}

export function FestivalesList({ festivals }: { festivals: Festival[] }) {
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('evento');

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) return festivals;
    return festivals.filter((f) => normalizeText(`${f.nombre} ${f.ciudad}`).includes(q));
  }, [festivals, query]);

  const groups = useMemo(() => {
    if (groupBy === 'evento') return [{ key: '__all__', label: null as string | null, items: filtered }];
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
  }, [filtered, groupBy]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o ciudad…"
          className="min-w-[16rem] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Agrupar:</span>
          {(
            [
              { id: 'evento', label: 'Por evento' },
              { id: 'artista', label: 'Por artista' },
              { id: 'estado', label: 'Por estado' },
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

      {filtered.length === 0 && (
        <p className="text-sm text-gray-500">
          {festivals.length === 0 ? 'No hay festivales todavía.' : 'Nada coincide con esa búsqueda.'}
        </p>
      )}

      {groupBy === 'evento' ? (
        <ul className="flex flex-col gap-3">
          {filtered.map((f) => (
            <FestivalRow key={f.id} festival={f} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g) => (
            <GroupSection key={g.key} label={g.label ?? ''} festivals={g.items} defaultOpen={groups.length <= 5} />
          ))}
        </div>
      )}
    </div>
  );
}
