import { createClient } from '@/lib/supabase/server';

export type AdminCheck =
  | { authorized: true; userId: string; email: string }
  | { authorized: false; userId: string | null; email: string | null };

export async function requireAdmin(): Promise<AdminCheck> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, userId: null, email: null };
  }

  const { data: row } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!row?.is_admin) {
    return { authorized: false, userId: user.id, email: user.email ?? null };
  }

  return { authorized: true, userId: user.id, email: user.email ?? '' };
}
