'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { requestPasswordReset } from './actions';

const initialState = { error: '', sent: false };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    async (_: typeof initialState, formData: FormData) => {
      const result = await requestPasswordReset(formData);
      return { error: result.error ?? '', sent: Boolean(result.sent) };
    },
    initialState,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Musicaleando admin</h1>
        <p className="text-sm text-gray-500">Recuperar contraseña</p>
      </div>

      {state.sent ? (
        <p className="text-sm text-gray-700">
          Si ese email tiene una cuenta, te llegó un link para elegir una contraseña nueva.
          Revisa también spam.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="rounded-md border border-gray-300 px-3 py-2"
          />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {pending ? 'Enviando…' : 'Enviar link de recuperación'}
          </button>
        </form>
      )}

      <p className="text-sm text-gray-500">
        <Link href="/login" className="underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </main>
  );
}
