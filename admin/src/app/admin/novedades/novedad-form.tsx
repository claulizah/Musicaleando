'use client';

import { useState, useTransition } from 'react';
import { createNovedad } from './actions';
import { NOVEDAD_PANTALLAS } from '@/lib/novedades';

export function NovedadForm() {
  const [id, setId] = useState('');
  const [pantalla, setPantalla] = useState(NOVEDAD_PANTALLAS[0].id);
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [vigente, setVigente] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        startTransition(async () => {
          const res = await createNovedad({ id, pantalla, titulo, cuerpo, vigente_hasta: vigente });
          if (res.error) {
            setError(res.error);
            return;
          }
          setError('');
          setSaved(true);
          setId('');
          setTitulo('');
          setCuerpo('');
          setVigente('');
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Identificador (único)
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="squads-v2"
            className="rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Pantalla donde aparece
          <select value={pantalla} onChange={(e) => setPantalla(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            {NOVEDAD_PANTALLAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        Título
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Texto
        <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={3} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Vigente hasta (opcional — sin fecha se muestra hasta que el usuario lo cierre)
        <input type="date" value={vigente} onChange={(e) => setVigente(e.target.value)} className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50">
          {pending ? 'Publicando…' : 'Publicar aviso'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !error && <p className="text-sm text-green-700">Publicado — cada usuario lo verá una vez.</p>}
      </div>
    </form>
  );
}
