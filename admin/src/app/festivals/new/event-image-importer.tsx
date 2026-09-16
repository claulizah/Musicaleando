'use client';

import { useRef, useState } from 'react';
import { extractEventFromImage, type ExtractedEvent, type DuplicateMatch } from '../../candidatos/actions';
import { ExtractedEventPreview } from './extracted-event-preview';

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
        <ExtractedEventPreview
          extracted={extracted}
          duplicate={duplicate}
          source="poster_image"
          onChange={setExtracted}
          onDone={() => setDone(true)}
          onCancel={reset}
        />
      )}
    </div>
  );
}
