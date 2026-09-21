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

test('estado: el usuario guarda su propio estado y lo lee de vuelta', async () => {
  const up = await fetch(`${URL_}/rest/v1/users?id=eq.${userId}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({ ciudad: 'Jalisco' }),
  });
  const rows = (await up.json()) as { id: string; ciudad: string | null }[];
  assert.deepEqual([rows[0]?.id, rows[0]?.ciudad], [userId, 'Jalisco']);
});

test('estado: no se puede cambiar el estado de otro usuario', async () => {
  const other = await fetch(`${URL_}/rest/v1/users?id=neq.${userId}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({ ciudad: 'Yucatán' }),
  });
  assert.deepEqual(await other.json(), [], 'RLS no debe dejar tocar filas ajenas');
});

test('novedades: cualquier usuario las lee pero no puede crearlas', async () => {
  const read = await fetch(`${URL_}/rest/v1/novedades?select=id`, { headers: headers() });
  assert.equal(read.status, 200);
  const write = await fetch(`${URL_}/rest/v1/novedades`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id: 'intento-no-admin', pantalla: 'Home', titulo: 'x', cuerpo: 'x' }),
  });
  assert.equal(write.status, 403);
});

test('novedades: un usuario solo marca avisos como vistos a su nombre', async () => {
  const forged = await fetch(`${URL_}/rest/v1/novedades_vistas`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000001', novedad_id: 'no-existe' }),
  });
  assert.equal(forged.status, 403);
});

test('métricas: un usuario normal no puede llamar admin_metrics', async () => {
  const res = await fetch(`${URL_}/rest/v1/rpc/admin_metrics`, { method: 'POST', headers: headers(), body: '{}' });
  assert.notEqual(res.status, 200);
  assert.match(JSON.stringify(await res.json()), /No autorizado/);
});

test('descuentos: un usuario normal no puede cambiar descuentos/preventas de un evento', async () => {
  const fest = await fetch(`${URL_}/rest/v1/festivals?select=id&estado_evento=eq.activo&limit=1`, { headers: headers() });
  const festivalId = ((await fest.json()) as { id: string }[])[0].id;
  const res = await fetch(`${URL_}/rest/v1/festivals?id=eq.${festivalId}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify({ tipo_descuento: '2x1', descuento_detalle: 'intento no-admin' }),
  });
  const rows = res.ok ? ((await res.json()) as unknown[]) : [];
  assert.deepEqual(rows, [], 'RLS no debe dejar modificar el evento');
  const after = await fetch(`${URL_}/rest/v1/festivals?select=tipo_descuento&id=eq.${festivalId}`, { headers: headers() });
  assert.deepEqual(await after.json(), [{ tipo_descuento: null }], 'el evento sigue sin descuento');
});

test('descuentos: el banner es legible por la app pero no editable por un usuario normal', async () => {
  const write = await fetch(`${URL_}/rest/v1/app_config`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ key: 'banner_descuentos', value: 'intento no-admin' }),
  });
  assert.equal(write.status, 403);
});

test('onboarding: cada paso se registra a nombre propio y el duplicado se ignora', async () => {
  const send = () =>
    fetch(`${URL_}/rest/v1/onboarding_progress?on_conflict=user_id,paso`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=ignore-duplicates' }),
      body: JSON.stringify({ user_id: userId, paso: 3, paso_nombre: 'quiz_02_generos' }),
    });
  assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 201, 'reintentar el mismo paso no da error');
  const rows = await fetch(`${URL_}/rest/v1/onboarding_progress?select=paso,paso_nombre`, { headers: headers() });
  assert.deepEqual(await rows.json(), [{ paso: 3, paso_nombre: 'quiz_02_generos' }], 'queda una sola fila');
});

test('onboarding: no se puede registrar un paso a nombre de otro usuario', async () => {
  const res = await fetch(`${URL_}/rest/v1/onboarding_progress`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ user_id: '00000000-0000-0000-0000-000000000001', paso: 2, paso_nombre: 'quiz_01_duelo_visual' }),
  });
  assert.equal(res.status, 403);
});

test('onboarding: un usuario normal no puede llamar al embudo del admin', async () => {
  const res = await fetch(`${URL_}/rest/v1/rpc/admin_onboarding_funnel`, { method: 'POST', headers: headers(), body: '{}' });
  assert.notEqual(res.status, 200);
  assert.match(JSON.stringify(await res.json()), /No autorizado/);
});
