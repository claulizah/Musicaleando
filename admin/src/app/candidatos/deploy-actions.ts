'use server';

import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

// No disparar otro rebuild si el último se disparó hace menos de esto —
// evita doble-click accidental o spam. Ver prompt-siguiente-republicar-sitio.md.
const COOLDOWN_MS = 3 * 60 * 1000;

// musicaleando-site es Direct Upload en Cloudflare Pages (no conectado por
// Git), así que no existe un Deploy Hook real de Cloudflare que disparar —
// ver prompt-siguiente-pipeline-cicd-public-site.md. El build+deploy real
// vive en .github/workflows/deploy-public-site.yml (workflow_dispatch
// únicamente), y este botón lo dispara vía la API de GitHub en vez de un
// webhook de Cloudflare.
const GITHUB_OWNER = 'claulizah';
const GITHUB_REPO = 'Musicaleando';
const WORKFLOW_FILE = 'deploy-public-site.yml';

export type TriggerDeployResult =
  | { ok: true; triggeredAt: string }
  | { ok: false; reason: 'cooldown'; cooldownRemainingMs: number }
  | { ok: false; reason: 'auth' | 'config' | 'network' | 'github' | 'db'; message: string };

export async function getLastSiteDeploy(): Promise<{ lastTriggeredAt: string | null }> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { lastTriggeredAt: null };

  const supabase = await createClient();
  const { data } = await supabase
    .from('site_deploys')
    .select('triggered_at')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { lastTriggeredAt: data?.triggered_at ?? null };
}

// Dispara el workflow de GitHub Actions que compila y publica public-site
// (build + wrangler pages deploy corren ahí, no en Cloudflare — ver el
// workflow). Esto solo arranca el run — no hay forma de ver su progreso/
// éxito desde aquí sin darle a este server más permisos de los que necesita;
// eso se sigue viendo en la pestaña Actions de GitHub, igual que se iba a
// ver en el dashboard de Cloudflare con el enfoque de Deploy Hook original.
export async function triggerSiteDeploy(): Promise<TriggerDeployResult> {
  const admin = await requireAdmin();
  if (!admin.authorized) return { ok: false, reason: 'auth', message: 'No autorizado.' };

  const githubToken = process.env.GITHUB_ACTIONS_TOKEN;
  if (!githubToken) {
    return {
      ok: false,
      reason: 'config',
      message: 'Falta configurar GITHUB_ACTIONS_TOKEN en el servidor.',
    };
  }

  const supabase = await createClient();

  const { data: last } = await supabase
    .from('site_deploys')
    .select('triggered_at')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last?.triggered_at) {
    const elapsed = Date.now() - new Date(last.triggered_at).getTime();
    if (elapsed < COOLDOWN_MS) {
      return { ok: false, reason: 'cooldown', cooldownRemainingMs: COOLDOWN_MS - elapsed };
    }
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
      },
    );
  } catch {
    return {
      ok: false,
      reason: 'network',
      message: 'No se pudo contactar a GitHub. Intenta de nuevo en un momento.',
    };
  }

  // GitHub responde 204 sin body cuando el dispatch se aceptó.
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return {
      ok: false,
      reason: 'github',
      message: `GitHub respondió ${res.status}. Revisa que GITHUB_ACTIONS_TOKEN siga vigente y tenga permiso de Actions sobre el repo.${detail ? ` (${detail.slice(0, 200)})` : ''}`,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('site_deploys')
    .insert({ triggered_by: admin.userId })
    .select('triggered_at')
    .single();
  // El workflow ya se disparó en GitHub aunque esto falle — no hay nada que
  // revertir, solo se pierde el registro para el rate limit/UI.
  if (insertError) {
    return { ok: true, triggeredAt: new Date().toISOString() };
  }

  return { ok: true, triggeredAt: inserted.triggered_at };
}
