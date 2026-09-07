'use client';

import { useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { updateMapaUrl, addMapPin, deleteMapPin } from './actions';

type Pin = {
  id: string;
  escenario: string;
  x_pct: number;
  y_pct: number;
};

export function MapUploader({
  festivalId,
  mapaUrl,
  pins,
  escenarios,
}: {
  festivalId: string;
  mapaUrl: string | null;
  pins: Pin[];
  escenarios: string[];
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [escenarioInput, setEscenarioInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  async function handleFile(file: File) {
    setError('');
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() || 'png';
      const path = `${festivalId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('festival-maps')
        .upload(path, file, { upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('festival-maps').getPublicUrl(path);
      const res = await updateMapaUrl(festivalId, publicUrlData.publicUrl);
      if (res.error) setError(res.error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setEscenarioInput('');
  }

  function confirmPin() {
    if (!pendingPin || !escenarioInput.trim()) return;
    startTransition(async () => {
      const res = await addMapPin(festivalId, escenarioInput, pendingPin.x, pendingPin.y);
      if (res.error) setError(res.error);
      setPendingPin(null);
      setEscenarioInput('');
    });
  }

  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-4">
      <p className="mb-2 text-sm font-medium">Mapa del recinto</p>
      <p className="mb-3 text-xs text-gray-500">
        Sube una imagen del plano del festival, luego toca sobre la imagen para colocar un pin
        por escenario (posición relativa, no coordenadas GPS reales).
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
      {uploading && <p className="mt-2 text-sm text-gray-500">Subiendo imagen…</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {mapaUrl && (
        <div className="relative mt-4 inline-block max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={mapaUrl}
            alt="Mapa del festival"
            onClick={handleImageClick}
            className="max-w-full cursor-crosshair rounded-md border border-gray-200"
          />
          {pins.map((pin) => (
            <div
              key={pin.id}
              title={pin.escenario}
              style={{ left: `${pin.x_pct}%`, top: `${pin.y_pct}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 px-2 py-1 text-xs text-white shadow"
            >
              📍 {pin.escenario}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startTransition(() => {
                    deleteMapPin(festivalId, pin.id);
                  });
                }}
                className="ml-1 underline"
              >
                ×
              </button>
            </div>
          ))}
          {pendingPin && (
            <div
              style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border border-gray-300 bg-white p-2 shadow-lg"
            >
              <input
                autoFocus
                list="escenarios-list"
                value={escenarioInput}
                onChange={(e) => setEscenarioInput(e.target.value)}
                placeholder="Nombre del escenario"
                className="w-40 rounded border border-gray-300 px-2 py-1 text-xs"
              />
              <datalist id="escenarios-list">
                {escenarios.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  disabled={pending || !escenarioInput.trim()}
                  onClick={confirmPin}
                  className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
                >
                  Guardar pin
                </button>
                <button
                  type="button"
                  onClick={() => setPendingPin(null)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
