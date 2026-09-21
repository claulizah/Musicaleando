import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Prueba de integración contra el backend REAL (Supabase de producción) con
// una cuenta anónima descartable — la misma que crea la app al abrirse. NO
// corre con `npm test` (necesita red y deja una identidad "Usuario eliminado",
// por diseño del borrado de cuenta): se lanza con `npm run test:integration`.
function readEnv(): { url: string; key: string } {
  let url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  let key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    const text = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
    url = /^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m.exec(text)?.[1]?.trim();
    key = /^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m.exec(text)?.[1]?.trim();
  }
  assert.ok(url && key, 'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (.env)');
  return { url, key };
}

const { url: URL_, key: ANON } = readEnv();
let token = '';
let userId = '';

const headers = (extra: Record<string, string> = {}) => ({
  apikey: ANON,
  Authorization: `Bearer ${token || ANON}`,
  'Content-Type': 'application/json',
  ...extra,
});

before(async () => {
  const res = await fetch(`${URL_}/auth/v1/signup`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 200, 'el inicio de sesión anónimo debe funcionar');
  const body = (await res.json()) as { access_token?: string; user?: { id: string } };
  token = body.access_token ?? '';
  userId = body.user?.id ?? '';
});

after(async () => {
  if (!token) return;
  const res = await fetch(`${URL_}/functions/v1/delete-account`, { method: 'POST', headers: headers() });
  assert.equal(res.status, 200, 'la cuenta de prueba debe poder borrarse (limpieza)');
  const me = await fetch(`${URL_}/auth/v1/user`, { headers: headers() });
  assert.notEqual(me.status, 200, 'tras borrar la cuenta, la sesión ya no debe ser válida');
});

test('login anónimo: entrega un token y un usuario autenticado', () => {
  assert.ok(token.split('.').length === 3, 'el token debe ser un JWT');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.equal(payload.role, 'authenticated');
  assert.equal(payload.sub, userId);
  assert.equal(payload.is_anonymous, true);
});

test('login: se crea automáticamente la fila del usuario en public.users', async () => {
  const res = await fetch(`${URL_}/rest/v1/users?select=id&id=eq.${userId}`, { headers: headers() });
  assert.deepEqual(await res.json(), [{ id: userId }]);
});

test('catálogo: un usuario nuevo ve eventos activos y ninguno archivado', async () => {
  const res = await fetch(`${URL_}/rest/v1/festivals?select=id,estado_evento&estado_evento=eq.activo&limit=5`, { headers: headers() });
  const rows = (await res.json()) as { estado_evento: string }[];
  assert.ok(rows.length > 0, 'debe haber eventos activos');
  assert.ok(rows.every((r) => r.estado_evento === 'activo'));
});

test('privacidad: un usuario nuevo no ve intereses de otros usuarios', async () => {
  const res = await fetch(`${URL_}/rest/v1/festival_intent?select=user_id&user_id=neq.${userId}`, { headers: headers() });
  assert.deepEqual(await res.json(), []);
});

// plataforma 'prueba-automatica': el reporte y las métricas del admin ignoran estos clics.
test('compra: el clic en "Comprar boletos" se registra a nombre propio', async () => {
  const fest = await fetch(`${URL_}/rest/v1/festivals?select=id&link_boletos=like.*ticketmaster*&limit=1`, { headers: headers() });
  const festivalId = ((await fest.json()) as { id: string }[])[0].id;
  const res = await fetch(`${URL_}/rest/v1/ticket_clicks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ festival_id: festivalId, user_id: userId, plataforma: 'prueba-automatica', afiliado: false }),
  });
  assert.equal(res.status, 201);
});

test('compra: no se puede registrar un clic a nombre de otro usuario', async () => {
  const res = await fetch(`${URL_}/rest/v1/ticket_clicks`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000001', plataforma: 'ticketmaster' }),
  });
  assert.equal(res.status, 403);
});

test('compra: un usuario normal no puede leer los clics de nadie', async () => {
  const res = await fetch(`${URL_}/rest/v1/ticket_clicks?select=id`, { headers: headers() });
  assert.deepEqual(await res.json(), []);
});

test('compra: la plantilla de afiliado es legible por la app pero no editable', async () => {
  const read = await fetch(`${URL_}/rest/v1/app_config?select=key,value`, { headers: headers() });
  assert.equal(read.status, 200);
  const write = await fetch(`${URL_}/rest/v1/app_config`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ key: 'affiliate_url_template', value: 'https://evil.example/?u={url}' }),
  });
  assert.equal(write.status, 403, 'un usuario normal no debe poder cambiar la plantilla de afiliado');
});
