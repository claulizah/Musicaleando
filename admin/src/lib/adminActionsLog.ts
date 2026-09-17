import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type AdminAction = 'aprobar' | 'rechazar' | 'editar' | 'deshacer_aprobar' | 'deshacer_rechazar';
export type AdminActionTarget = 'candidato' | 'festival';

// Bitácora simple — se llama desde los mismos puntos donde ya vive la
// lógica de aprobar/rechazar/deshacer (nunca la duplica). Best-effort: un
// fallo al loguear nunca debe tumbar la acción real que sí importa (aprobar/
// rechazar ya se hizo cuando esto se llama), solo se reporta a consola.
export async function logAdminAction(
  supabase: SupabaseClient<Database>,
  adminId: string,
  action: AdminAction,
  targetType: AdminActionTarget,
  targetId: string,
  options?: { isBulk?: boolean; detail?: Record<string, unknown> },
): Promise<void> {
  const { error } = await supabase.from('admin_actions_log').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    is_bulk: options?.isBulk ?? false,
    detail: options?.detail ?? {},
  });
  if (error) console.error('No se pudo registrar en admin_actions_log (no bloqueante):', error);
}
