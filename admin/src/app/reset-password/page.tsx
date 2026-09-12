'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Status = 'checking' | 'ready' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // The recovery link lands here with a token in the URL that the browser
    // client (detectSessionInUrl, on by default) turns into a session on
    // load — that's what makes updateUser() below allowed. If the link was
    // already used or has expired, no session shows up and we say so instead
    // of rendering a form that would just fail.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready');
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus('ready');
      else setStatus((s) => (s === 'checking' ? 'invalid' : s));
    });

    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push('/');
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Musicaleando admin</h1>
        <p className="text-sm text-gray-500">Elegir contraseña nueva</p>
      </div>

      {status === 'checking' && <p className="text-sm text-gray-500">Verificando link…</p>}

      {status === 'invalid' && (
        <p className="text-sm text-red-600">
          Este link ya no es válido o expiró.{' '}
          <Link href="/forgot-password" className="underline">
            Pide uno nuevo
          </Link>
          .
        </p>
      )}

      {status === 'ready' && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Contraseña nueva"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          <input
            type="password"
            placeholder="Repite la contraseña nueva"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar contraseña nueva'}
          </button>
        </form>
      )}
    </main>
  );
}
