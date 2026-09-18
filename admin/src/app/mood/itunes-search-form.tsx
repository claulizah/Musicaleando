'use client';

import { useEffect, useState, useTransition } from 'react';
import { addFromItunes } from './actions';

// La iTunes Search API es pública, sin API key, y responde con
// Access-Control-Allow-Origin: * — se llama directo desde el navegador, sin
// necesidad de una ruta proxy en el servidor.
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

type ItunesTrack = {
  trackId: number;
  trackName: string;
  artistName: string;
  primaryGenreName?: string;
  artworkUrl60?: string;
};

export function ItunesSearchForm({ moods }: { moods: { id: string; label: string }[] }) {
  const [moodId, setMoodId] = useState(moods[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ItunesTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const url = `${ITUNES_SEARCH_URL}?media=music&entity=song&limit=8&term=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('bad status');
        const data = (await res.json()) as { results?: ItunesTrack[] };
        setResults(data.results ?? []);
      } catch {
        setError('No se pudo buscar en iTunes. Intenta de nuevo.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setAdded(null);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError('');
    }
  }

  function handleSelect(track: ItunesTrack) {
    startTransition(async () => {
      const result = await addFromItunes(moodId, track.trackName, track.artistName, track.primaryGenreName ?? null);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setAdded(`${track.trackName} — ${track.artistName}`);
      setResults([]);
      setQuery('');
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium">Buscar canción en iTunes</p>
      <label className="flex flex-col gap-1 text-sm">
        Mood
        <select
          value={moodId}
          onChange={(e) => setMoodId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          {moods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Canción o artista
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="ej. Bad Bunny, Nueva York…"
          className="rounded-md border border-gray-300 px-3 py-2"
        />
      </label>

      {loading && <p className="text-xs text-gray-400">Buscando…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {added && <p className="text-sm text-green-600">Agregada: {added}</p>}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((r) => (
            <li key={r.trackId}>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleSelect(r)}
                className="flex w-full items-center gap-3 rounded-md border border-gray-100 bg-gray-50 p-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                {r.artworkUrl60 && (
                  // Miniatura de iTunes — dominio externo no listado en next/image, y no
                  // vale la pena configurarlo para una lista de resultados transitoria.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.artworkUrl60} alt="" className="h-10 w-10 flex-shrink-0 rounded" />
                )}
                <span>
                  <span className="block font-medium">{r.trackName}</span>
                  <span className="block text-xs text-gray-500">
                    {r.artistName}
                    {r.primaryGenreName ? ` · ${r.primaryGenreName}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
