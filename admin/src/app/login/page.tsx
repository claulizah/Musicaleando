'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login } from './actions';

const initialState = { error: '' };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(async (_: typeof initialState, formData: FormData) => {
    const result = await login(formData);
    return result ?? initialState;
  }, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Musicaleando admin</h1>
        <p className="text-sm text-gray-500">Iniciar sesión</p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          required
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="text-sm text-gray-500">
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="underline">
          Crear cuenta
        </Link>
      </p>
    </main>
  );
}
