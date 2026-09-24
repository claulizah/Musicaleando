'use client';

import { useMemo, useState, useTransition } from 'react';
import { ARTIST_GENRES, genreLabel } from '@/lib/artistGenres';
import { setArtistGenres } from './actions';

export type ArtistRow = { id: string; name: string; genres: string[] | null; genre_other: string | null; eventos: number };

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const PAGE = 100;

export function ArtistasList({ artists }: { artists: ArtistRow[] }) {
  const [rows, setRows] = useState(artists);
  const [query, setQuery] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return rows.filter((a) => (!q || normalize(a.name).includes(q)) && (!onlyMissing || !a.genres || a.genres.length === 0));
  }, [rows, query, onlyMissing]);

  const withGenre = rows.filter((a) => a.genres && a.genres.length > 0).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Buscar artista…"
          className="min-w-64 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => {
              setOnlyMissing(e.target.checked);
              setLimit(PAGE);
            }}
          />
          Solo sin género
        </label>
        <span className="text-xs text-gray-500">
          {withGenre} de {rows.length} con género · {filtered.length} en pantalla
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {filtered.slice(0, limit).map((a) => (
          <ArtistItem
            key={a.id}
            artist={a}
            open={openId === a.id}
            onToggle={() => setOpenId(openId === a.id ? null : a.id)}
            onSaved={(genres, other) =>
              setRows((prev) => prev.map((r) => (r.id === a.id ? { ...r, genres, genre_other: other } : r)))
            }
          />
        ))}
      </ul>
      {filtered.length > limit && (
        <button type="button" onClick={() => setLimit(limit + PAGE)} className="mt-3 text-sm underline">
          Mostrar {Math.min(PAGE, filtered.length - limit)} más
        </button>
      )}
      {filtered.length === 0 && <p className="mt-4 text-sm text-gray-500">Ningún artista coincide.</p>}
    </div>
  );
}

function ArtistItem({
  artist,
  open,
  onToggle,
  onSaved,
}: {
  artist: ArtistRow;
  open: boolean;
  onToggle: () => void;
  onSaved: (genres: string[] | null, other: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [other, setOther] = useState(artist.genre_other ?? '');
  const current = artist.genres ?? [];

  const save = (next: string[], nextOther: string) => {
    setError(null);
    startTransition(async () => {
      const res = await setArtistGenres(artist.id, next, nextOther);
      if (res.error) setError(res.error);
      else onSaved(res.genres ?? null, res.genre_other ?? null);
    });
  };

  const toggle = (id: string) => save(current.includes(id) ? current.filter((g) => g !== id) : [...current, id], other);

  return (
    <li className="rounded-lg border border-gray-200 bg-white text-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
        <span>
          <span className="font-medium">{artist.name}</span>{' '}
          <span className="text-xs text-gray-400">
            · {artist.eventos} {artist.eventos === 1 ? 'evento' : 'eventos'}
          </span>
        </span>
        <span className="flex flex-wrap justify-end gap-1">
          {current.length === 0 ? (
            <span className="text-xs text-gray-400">sin género</span>
          ) : (
            current.map((g) => (
              <span key={g} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                {g === 'otro' && artist.genre_other ? `Otro: ${artist.genre_other}` : genreLabel(g)}
              </span>
            ))
          )}
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-3 py-3">
          <div className="flex flex-wrap gap-2">
            {ARTIST_GENRES.map((g) => {
              const on = current.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(g.id)}
                  title={g.hint || undefined}
                  className={`rounded-full border px-3 py-1 text-xs disabled:opacity-60 ${
                    on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
          {current.includes('otro') && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={other}
                onChange={(e) => setOther(e.target.value)}
                onBlur={() => save(current, other)}
                placeholder="¿Qué género? (texto libre)"
                maxLength={80}
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          )}
          <p className="mt-2 text-xs text-gray-400">
            {pending ? 'Guardando…' : error ? <span className="text-red-600">{error}</span> : 'Se guarda al instante.'}
          </p>
        </div>
      )}
    </li>
  );
}
