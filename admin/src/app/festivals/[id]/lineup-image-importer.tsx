'use client';

import { useRef, useState, useTransition } from 'react';
import {
  extractLineupFromImage,
  approveLineupCandidate,
  discardLineupCandidate,
  discardLineupBatch,
  LineupCandidate,
} from './actions';
import { resolveDayFromLabel, to24h } from '@/lib/lineupTimes';

const CONFIANZA_COLOR: Record<string, string> = {
  alta: 'text-green-700',
  media: 'text-amber-700',
  baja: 'text-red-600',
};

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is a data: URL — strip the "data:image/png;base64," prefix.
      const base64 = result.slice(result.indexOf(',') + 1);
      resolve({ base64, mediaType: file.type || 'image/png' });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function EditableRow({
  festivalId,
  candidate,
  defaultDia,
  assume12h,
}: {
  festivalId: string;
  candidate: LineupCandidate;
  defaultDia: string;
  assume12h: boolean;
}) {
  const [artista, setArtista] = useState(candidate.artista);
  const [escenario, setEscenario] = useState(candidate.escenario ?? '');
  const [dia, setDia] = useState(defaultDia);
  const [inicio, setInicio] = useState(candidate.hora_inicio ?? '');
  const [fin, setFin] = useState(candidate.hora_fin ?? '');
  const [nivel, setNivel] = useState(candidate.nivel ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  // Lo que se va a guardar, ya en 24 horas — se muestra antes de aprobar para
  // que un "8:10" de cartel no se guarde como madrugada sin que lo notes.
  const inicio24 = inicio.trim() ? to24h(inicio, assume12h) : null;
  const fin24 = fin.trim() ? to24h(fin, assume12h) : null;
  const inicioMalo = inicio.trim() !== '' && !inicio24;
  const finMalo = fin.trim() !== '' && !fin24;

  const approve = () => {
    setError('');
    startTransition(async () => {
      const res = await approveLineupCandidate(festivalId, candidate.id, {
        artista,
        escenario: escenario || null,
        dia,
        inicio: inicio24,
        fin: fin24,
        nivel: nivel || null,
      });
      if (res.error) setError(res.error);
    });
  };

  const discard = () => {
    startTransition(async () => {
      await discardLineupCandidate(festivalId, candidate.id);
    });
  };

  return (
    <li className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase ${CONFIANZA_COLOR[candidate.confianza] ?? ''}`}>
          confianza {candidate.confianza}
        </span>
        {candidate.nota && <span className="text-xs text-gray-400">{candidate.nota}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={artista}
          onChange={(e) => setArtista(e.target.value)}
          placeholder="Artista"
          className="min-w-[10rem] flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <input
          value={escenario}
          onChange={(e) => setEscenario(e.target.value)}
          placeholder="Escenario"
          className="w-32 rounded border border-gray-300 px-2 py-1"
        />
        <input
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        />
        <input
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          placeholder="Inicio"
          className={`w-20 rounded border px-2 py-1 ${inicioMalo ? 'border-red-400' : 'border-gray-300'}`}
        />
        <input
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          placeholder="Fin"
          className={`w-20 rounded border px-2 py-1 ${finMalo ? 'border-red-400' : 'border-gray-300'}`}
        />
        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
          aria-label="Nivel en el cartel"
        >
          <option value="">Nivel: sin definir</option>
          <option value="estelar">Estelar</option>
          <option value="destacado">Destacado</option>
          <option value="general">General</option>
        </select>
      </div>
      <p className="text-xs text-gray-500">
        {inicioMalo || finMalo
          ? 'No entiendo la hora — escríbela como 20:20 o 8:10 pm.'
          : inicio24
            ? `Se guardará: ${inicio24}${fin24 ? `–${fin24}` : ''} (24 h)`
            : 'Sin hora: se guardará solo el día.'}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending || !artista.trim() || inicioMalo || finMalo}
          onClick={approve}
          className="text-xs text-green-700 underline disabled:opacity-50"
        >
          Aprobar y publicar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={discard}
          className="text-xs text-red-600 underline disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
    </li>
  );
}

// Un cartel de horarios trae "8:10" sin am/pm. Si ninguna hora del lote pasa
// de las 12, casi seguro es formato de 12 h (un festival no empieza a las
// 8 a.m.): se sugiere activarlo, y se puede cambiar antes de aprobar.
function guess12h(candidates: LineupCandidate[]): boolean {
  const hours = candidates
    .flatMap((c) => [c.hora_inicio, c.hora_fin])
    .map((h) => to24h(h, false))
    .filter((h): h is string => h !== null)
    .map((h) => Number(h.slice(0, 2)));
  return hours.length > 0 && hours.every((h) => h <= 12);
}

function BatchBlock({
  festivalId,
  fechaInicio,
  fechaFin,
  batch,
}: {
  festivalId: string;
  fechaInicio: string;
  fechaFin: string;
  batch: { batchId: string; diaLabel: string | null; candidates: LineupCandidate[] };
}) {
  const { batchId, diaLabel, candidates } = batch;
  const [assume12h, setAssume12h] = useState(() => guess12h(candidates));
  const [pending, startTransition] = useTransition();
  const resolved = resolveDayFromLabel(diaLabel, fechaInicio, fechaFin);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-600">
          {diaLabel ?? 'Día no identificado'}
          {resolved ? ` → ${resolved}` : ' → elige el día en cada fila'} · {candidates.length} candidatos
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await discardLineupBatch(festivalId, batchId);
            })
          }
          className="text-xs text-gray-500 underline"
        >
          Descartar lote completo
        </button>
      </div>
      <label className="mb-2 flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={assume12h} onChange={(e) => setAssume12h(e.target.checked)} />
        Las horas del cartel están en formato de 12 h sin am/pm (8:10 = 20:10)
      </label>
      <ul className="flex flex-col gap-2">
        {candidates.map((c) => (
          <EditableRow
            key={c.id}
            festivalId={festivalId}
            candidate={c}
            defaultDia={resolved ?? fechaInicio}
            assume12h={assume12h}
          />
        ))}
      </ul>
    </div>
  );
}

export function LineupImageImporter({
  festivalId,
  fechaInicio,
  fechaFin,
  pendingByBatch,
}: {
  festivalId: string;
  fechaInicio: string;
  fechaFin: string;
  pendingByBatch: { batchId: string; diaLabel: string | null; candidates: LineupCandidate[] }[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleFile(file: File) {
    setError('');
    setMessage('');
    setUploading(true);
    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await extractLineupFromImage(festivalId, base64, mediaType);
      if (res.error) {
        setError(res.error);
      } else {
        setMessage(
          `Se extrajeron ${res.count} bloques${res.esHorarioConTiempos === false ? ' (la imagen no parecía tener un grid de horarios legible — revisa con cuidado)' : ''}.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la imagen.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-4">
      <p className="mb-2 text-sm font-medium">Importar horario desde imagen</p>
      <p className="mb-3 text-xs text-gray-500">
        Sube el cartel/horario tal como lo descargas de redes sociales. La IA extrae los bloques
        como candidatos — nada se publica a Line-up hasta que apruebes cada uno abajo. Si el
        festival publica un horario por día, sube una imagen a la vez. El nivel (estelar /
        destacado / general) es una sugerencia de la IA por el tamaño del nombre en el cartel;
        confírmalo tú antes de aprobar.
      </p>

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
      {uploading && <p className="mt-2 text-sm text-gray-500">Extrayendo con IA…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}

      {pendingByBatch.map((batch) => (
        <BatchBlock
          key={batch.batchId}
          festivalId={festivalId}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          batch={batch}
        />
      ))}
    </div>
  );
}
