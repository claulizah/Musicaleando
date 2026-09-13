'use client';

import { useRef, useState, useTransition } from 'react';
import {
  extractLineupFromImage,
  approveLineupCandidate,
  discardLineupCandidate,
  discardLineupBatch,
  LineupCandidate,
} from './actions';

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
  defaultDate,
}: {
  festivalId: string;
  candidate: LineupCandidate;
  defaultDate: string;
}) {
  const [artista, setArtista] = useState(candidate.artista);
  const [escenario, setEscenario] = useState(candidate.escenario ?? '');
  const [fecha, setFecha] = useState(defaultDate);
  const [hora, setHora] = useState(candidate.hora_inicio ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const approve = () => {
    setError('');
    const horario = fecha && hora ? `${fecha}T${hora}:00` : null;
    startTransition(async () => {
      const res = await approveLineupCandidate(festivalId, candidate.id, {
        artista,
        escenario: escenario || null,
        horario,
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
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        />
        <input
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          placeholder="HH:MM"
          className="w-20 rounded border border-gray-300 px-2 py-1"
        />
      </div>
      {candidate.hora_fin && (
        <p className="text-xs text-gray-400">Hora de fin leída en la imagen: {candidate.hora_fin} (no se guarda, festival_lineup solo tiene un horario de inicio)</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={pending || !artista.trim()}
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

export function LineupImageImporter({
  festivalId,
  fechaInicio,
  pendingByBatch,
}: {
  festivalId: string;
  fechaInicio: string;
  pendingByBatch: { batchId: string; diaLabel: string | null; candidates: LineupCandidate[] }[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

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
        festival publica un horario por día, sube una imagen a la vez.
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

      {pendingByBatch.map(({ batchId, diaLabel, candidates }) => (
        <div key={batchId} className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600">
              {diaLabel ?? 'Día no identificado'} · {candidates.length} candidatos
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
          <ul className="flex flex-col gap-2">
            {candidates.map((c) => (
              <EditableRow key={c.id} festivalId={festivalId} candidate={c} defaultDate={fechaInicio} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
