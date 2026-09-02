'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signup } from './actions';

const initialState = { error: '', message: '' };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(async (_: typeof initialState, formData: FormData) => {
    const result = await signup(formData);
    return result ?? initialState;
  }, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Musicaleando admin</h1>
        <p className="text-sm text-gray-500">Crear cuenta</p>
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
          placeholder="Contraseña (mín. 6 caracteres)"
          minLength={6}
          required
          className="rounded-md border border-gray-300 px-3 py-2"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.message && <p className="text-sm text-green-700">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="text-sm text-gray-500">
        La cuenta se crea sin permisos de admin. Después de crearla, pide que te den acceso.
      </p>
      <p className="text-sm text-gray-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
