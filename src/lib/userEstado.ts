import { supabase } from './supabase';
import { normalizeEstado } from './estadosMexico';

// El estado donde vive el usuario se guarda en users.ciudad: esa columna ya
// alimenta "Mi ciudad" en Trends, la comparación de energía y la segmentación
// de audiencia del admin, pero nunca se escribía desde la app (0 usuarios la
// tenían). Ahora siempre contiene uno de los 32 estados de estadosMexico.
export async function fetchUserEstado(userId: string): Promise<string | null> {
  const { data } = await supabase.from('users').select('ciudad').eq('id', userId).maybeSingle();
  return normalizeEstado(data?.ciudad);
}

export async function saveUserEstado(userId: string, estado: string | null): Promise<void> {
  const { error } = await supabase.from('users').update({ ciudad: normalizeEstado(estado) }).eq('id', userId);
  if (error) throw error;
}
