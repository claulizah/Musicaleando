import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// ---------- Envío reusable vía la API de Expo Push ----------
// https://exp.host/--/api/v2/push/send no requiere ninguna API key para
// mandar (solo para leer analíticas, que este proyecto no usa) — por eso
// esto vive como una función server-side normal en vez de una Edge
// Function: ya corre en el servidor de Next.js (server action), no hay
// nada que una Edge Function aparte resolviera mejor aquí.

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; details?: { error?: string } };

export type SendPushResult = {
  sent: number;
  // Tokens que Expo reportó como muertos (DeviceNotRegistered) — el
  // llamador debe podarlos de user_push_tokens para no seguir intentando.
  invalidTokens: string[];
  errors: string[];
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100; // límite real de la API de Expo por request.

// No falla nunca lanzando — mismo estándar "best-effort, nunca bloquea la
// acción real" que logAdminAction. El llamador decide si algo del resultado
// amerita loguear más fuerte.
export async function sendExpoPushNotifications(messages: ExpoPushMessage[]): Promise<SendPushResult> {
  const result: SendPushResult = { sent: 0, invalidTokens: [], errors: [] };
  if (messages.length === 0) return result;

  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      const json: { data?: ExpoPushTicket[]; errors?: unknown[] } = await response.json();
      if (!response.ok || !json.data) {
        result.errors.push(`Expo respondió ${response.status} sin tickets utilizables para un lote de ${batch.length}.`);
        continue;
      }
      json.data.forEach((ticket, idx) => {
        if (ticket.status === 'ok') {
          result.sent++;
          return;
        }
        // DeviceNotRegistered: el usuario desinstaló la app o revocó el
        // permiso — Expo mismo recomienda dejar de mandarle a ese token.
        if (ticket.details?.error === 'DeviceNotRegistered') {
          result.invalidTokens.push(batch[idx].to);
        } else {
          result.errors.push(`${batch[idx].to}: ${ticket.message}`);
        }
      });
    } catch (err) {
      result.errors.push(`Lote de ${batch.length} falló: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

// ---------- "Seguir artista" → agrupar destinatarios por usuario ----------
// Pura, sin I/O — testable sin mocks de Supabase/Expo. Un usuario puede
// seguir a varios artistas del mismo line-up (ej. dos artistas del mismo
// cartel), pero debe recibir UN solo push por evento, no uno por artista —
// esta función es la que garantiza esa deduplicación.
export type FollowedArtistRow = { user_id: string; artist_id: string };

export function groupFollowersByUser(
  lineupArtistIds: string[],
  follows: FollowedArtistRow[],
  artistNameById: Map<string, string>,
): Map<string, string[]> {
  const lineupSet = new Set(lineupArtistIds);
  const byUser = new Map<string, Set<string>>(); // user_id -> nombres de artistas seguidos en este line-up

  for (const follow of follows) {
    if (!lineupSet.has(follow.artist_id)) continue;
    const name = artistNameById.get(follow.artist_id);
    if (!name) continue;
    if (!byUser.has(follow.user_id)) byUser.set(follow.user_id, new Set());
    byUser.get(follow.user_id)!.add(name);
  }

  const result = new Map<string, string[]>();
  for (const [userId, names] of byUser) result.set(userId, [...names].sort());
  return result;
}

// Texto del push: "🎤 Nuevo evento de {artista}: {nombre} — {fecha}" para un
// solo artista seguido, o "🎤 Nuevo evento de {a} y {b}: ..." /
// "🎤 Nuevo evento de {a} y 2 más: ..." cuando el usuario sigue a varios del
// mismo cartel — sigue siendo un solo push, el texto solo lista a quién de
// sus seguidos le aplica.
export function buildPushBody(followedArtistNames: string[]): string {
  if (followedArtistNames.length === 1) return followedArtistNames[0];
  if (followedArtistNames.length === 2) return `${followedArtistNames[0]} y ${followedArtistNames[1]}`;
  return `${followedArtistNames[0]} y ${followedArtistNames.length - 1} más`;
}

function formatFechaCorta(fechaIso: string): string {
  return new Date(fechaIso + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export type NotifyFollowersResult = {
  usersNotified: number;
  pushesSent: number;
  invalidTokensPruned: number;
  errors: string[];
};

// Se llama desde approveCandidate justo después de que festival_lineup ya
// se insertó con éxito — best-effort: el llamador nunca debe dejar que un
// fallo acá tumbe una aprobación que de por sí ya se completó.
export async function notifyFollowersOfNewEvent(
  supabase: SupabaseClient<Database>,
  params: { festivalId: string; festivalNombre: string; fechaInicio: string; artistIds: string[] },
): Promise<NotifyFollowersResult> {
  const empty: NotifyFollowersResult = { usersNotified: 0, pushesSent: 0, invalidTokensPruned: 0, errors: [] };
  const artistIds = [...new Set(params.artistIds)];
  if (artistIds.length === 0) return empty;

  const [{ data: follows, error: followsError }, { data: artists, error: artistsError }] = await Promise.all([
    supabase.from('followed_artists').select('user_id, artist_id').in('artist_id', artistIds),
    supabase.from('artists').select('id, name').in('id', artistIds),
  ]);
  if (followsError) return { ...empty, errors: [followsError.message] };
  if (artistsError) return { ...empty, errors: [artistsError.message] };
  if (!follows || follows.length === 0) return empty;

  const artistNameById = new Map((artists ?? []).map((a) => [a.id, a.name]));
  const namesByUser = groupFollowersByUser(artistIds, follows, artistNameById);
  if (namesByUser.size === 0) return empty;

  const { data: tokens, error: tokensError } = await supabase
    .from('user_push_tokens')
    .select('user_id, push_token')
    .in('user_id', [...namesByUser.keys()]);
  if (tokensError) return { ...empty, errors: [tokensError.message] };
  if (!tokens || tokens.length === 0) return { ...empty, usersNotified: namesByUser.size };

  const fecha = formatFechaCorta(params.fechaInicio);
  const messages: ExpoPushMessage[] = tokens
    .filter((t) => namesByUser.has(t.user_id))
    .map((t) => ({
      to: t.push_token,
      title: '🎤 Nuevo evento',
      body: `${buildPushBody(namesByUser.get(t.user_id)!)}: ${params.festivalNombre} — ${fecha}`,
      data: { festivalId: params.festivalId },
    }));

  const sendResult = await sendExpoPushNotifications(messages);

  if (sendResult.invalidTokens.length > 0) {
    const { error: pruneError } = await supabase
      .from('user_push_tokens')
      .delete()
      .in('push_token', sendResult.invalidTokens);
    if (pruneError) {
      sendResult.errors.push(`No se pudieron podar ${sendResult.invalidTokens.length} tokens inválidos: ${pruneError.message}`);
    }
  }

  return {
    usersNotified: namesByUser.size,
    pushesSent: sendResult.sent,
    invalidTokensPruned: sendResult.invalidTokens.length,
    errors: sendResult.errors,
  };
}
