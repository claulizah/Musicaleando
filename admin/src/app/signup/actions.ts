'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signup(
  formData: FormData,
): Promise<{ error: string; message: string } | never> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message, message: '' };
  }

  if (!data.session) {
    return {
      error: '',
      message: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.',
    };
  }

  redirect('/');
}
