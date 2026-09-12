'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function requestPasswordReset(formData: FormData): Promise<{ error?: string; sent?: boolean }> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Escribe tu email.' };

  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = host?.startsWith('localhost') ? 'http' : 'https';
  const redirectTo = `${protocol}://${host}/reset-password`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Supabase returns success here even for an email that doesn't exist, by
  // design (avoids leaking which emails are registered) — so this always
  // reports "sent" rather than distinguishing found/not-found.
  if (error) return { error: error.message };
  return { sent: true };
}
