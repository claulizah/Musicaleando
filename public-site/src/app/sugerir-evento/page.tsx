'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

// Misma URL/anon key públicas que ya usa la app móvil (Supabase publishable
// key — segura de exponer en un sitio estático, protegida por RLS del lado
// del servidor). Este sitio es un export estático puro, sin server actions,
// así que el envío llama directo al Edge Function público.
const SUPABASE_URL = 'https://ijwyykfuyeaahvxmaild.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l6gO2eL5ILGd9XtthWjibg_gyLETNSs';

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.slice(result.indexOf(',') + 1), mediaType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function SugerirEventoPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [venue, setVenue] = useState('');
  const [link, setLink] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — un humano nunca lo llena
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('El nombre del evento es obligatorio.');
      return;
    }
    setError('');
    setSending(true);
    try {
      let poster: { base64: string; mediaType: string } | null = null;
      const file = fileInputRef.current?.files?.[0];
      if (file) poster = await fileToBase64(file);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-event-candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          nombre: nombre.trim(),
          fecha_inicio: fecha || null,
          ciudad: ciudad.trim() || null,
          venue: venue.trim() || null,
          link: link.trim() || null,
          poster_base64: poster?.base64 ?? null,
          poster_media_type: poster?.mediaType ?? null,
          website, // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar tu sugerencia. Intenta de nuevo.');
        return;
      }
      setDone(true);
    } catch {
      setError('No se pudo enviar tu sugerencia — revisa tu conexión e intenta de nuevo.');
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">¡Gracias!</h1>
        <p className="mt-3 text-sm text-gray-600">
          Tu sugerencia fue enviada. Un curador la va a revisar antes de que aparezca en Musicaleando
          — no se publica de inmediato.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          ← Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900">Sugiere un evento</h1>
      <p className="mt-2 text-sm text-gray-600">
        ¿Falta un concierto o festival en Musicaleando? Cuéntanos lo que sepas — no hace falta que
        tengas todos los datos. Un curador va a revisar tu sugerencia antes de que se publique, así
        que no aparece de inmediato.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nombre del evento *
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Fecha (si la sabes)
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Ciudad
            <input
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Venue
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Link a la fuente (opcional)
          <input
            type="url"
            placeholder="https://…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Foto del póster (opcional)
          <input ref={fileInputRef} type="file" accept="image/*" className="text-sm" />
        </label>

        {/* Honeypot — oculto para personas, visible para bots que rellenan todo */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
          <label>
            No llenes este campo
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={sending}
          className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {sending ? 'Enviando…' : 'Enviar sugerencia'}
        </button>
      </form>
    </main>
  );
}
