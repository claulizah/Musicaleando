# Estado del proyecto — Musicaleando

Última actualización: 2026-09-02 (sesión 3). Este archivo es el punto de partida para
retomar el trabajo en una sesión nueva sin perder contexto.

Proyecto Supabase: `ijwyykfuyeaahvxmaild` ("Sound Project", org `ljcnanwlkijozacnyhck`).
Repo: rama `master`, sin remoto configurado todavía.

## Completado y verificado en dispositivo (no solo compilado — probado tocando la app)

### Sprint 1
- Cuestionario de 10 preguntas (6 mecánicas distintas, nunca dos iguales seguidas), barra
  de progreso segmentada, guardado de progreso local (resumible).
- Motor de 12 arquetipos (energía baja/media/alta × eje social solo/dúo/grupo/líder),
  lookup determinista sin empates posibles. Verificado con al menos 3 combinaciones reales
  en dispositivo (`alta_solo`, `alta_lider`, `media_grupo`).
- Reveal: animación Lottie, confeti, compartir (captura + share sheet nativo) — verificado
  que la imagen compartida incluye la frase de sabor.
- Mood del día, perfil musical con "retomar y refinar".
- 51 imágenes ilustradas conectadas (assets/quiz/*, assets/archetypes/*), con fallback a
  emoji si falta una imagen. Redimensionadas de ~15.7MB a ~3.7MB total para carga rápida
  en red real (no solo en emulador).
- Falta 1 imagen originalmente: `archetypes/media_grupo.png` — ya apareció y está conectada.

### Sprint 2 (parcial — ver pendientes abajo)
- **Trend del día**: función SQL + `pg_cron` diario (9am) + generación bajo demanda si no
  hay trend de hoy (self-serve, RPC `generate_trend_for_user`, limitado a `auth.uid()` propio).
  Verificado en dispositivo: tarjeta con dato de arquetipo, compartible.
- **Playlist del día**: catálogo propio (tabla `songs`, contenido ficticio original — nombres
  de canciones/artistas inventados, no reales) filtrado por género + mood actual, con
  fallback a solo-género si no hay suficientes canciones para el mood exacto. Verificado en
  dispositivo con datos reales (rock+electrónica, mood chill → resultados correctos).
- **Squads**: crear (`create_squad` RPC), unirse por código de 6 caracteres (`join_squad`
  RPC), compat score vía trigger (cosine similarity sobre género+energía). Pantallas
  `SquadsScreen`/`SquadDetailScreen` verificadas visualmente (renderizan bien, sin crash).
  **No verificado end-to-end**: completar el flujo de crear/unirse un squad en vivo — el
  emulador tuvo un bug de teclado (ver "Problemas de entorno" abajo) que impidió escribir
  texto en los campos. El código usa el mismo patrón RPC+RLS que sí se probó con trends,
  así que hay alta confianza, pero no hay confirmación visual del flujo completo.
- **Festival Hub**: pantalla `FestivalHubScreen`, 3 festivales de ejemplo sembrados
  (ficticios, `link_boletos` apunta a `example.com` — placeholders). **Verificado
  end-to-end en emulador en la sesión 3** (ver detalle abajo): lista de festivales,
  line-up expandible, botones Voy/Tal vez/No voy con cambio visual confirmado y persistido
  en DB, botón Comprar boletos abriendo el navegador del dispositivo.

## Bug de RLS recursiva encontrado y arreglado (documentado para que no se repita)

**Causa raíz**: la política `squad_members_select_fellow` en la tabla `squad_members` hacía
un `EXISTS (SELECT 1 FROM squad_members sm2 WHERE ...)` — es decir, la política de una tabla
se referenciaba **a sí misma** dentro de su propio `USING`. Postgres detecta esto como
recursión infinita al evaluar RLS y responde con `500 Internal Server Error` en **cualquier**
query que toque `squad_members`, incluyendo indirectamente: `squads_select_member` (que
consulta `squad_members`) y `festival_intent_select_own_or_squadmate` (que también consulta
`squad_members` dos veces vía self-join `mine`/`theirs`).

Esto causó que `SquadsScreen` y `FestivalHubScreen` se quedaran en blanco/atascados sin
ningún error visible en la app (el `catch` guardaba el error en el store pero ninguna
pantalla tenía una rama de UI para `status === 'error'`, así que renderizaban nada).

**Cómo lo diagnostiqué**: revisé `edge_logs` vía el MCP de Supabase y encontré
`GET .../squad_members ... 500` y `GET .../festival_intent ... 500` — eso apuntó
directamente al problema antes de seguir adivinando por el lado de la app.

**Fix** (migración `fix_squad_members_rls_recursion`): se creó una función
`is_squad_member(p_squad_id uuid, p_user_id uuid) SECURITY DEFINER` que consulta
`squad_members` como el dueño de la función (bypassa RLS), rompiendo el ciclo. Las políticas
`squad_members_select_fellow` y `squads_select_member` ahora llaman a esta función en vez de
hacer un subquery directo contra `squad_members`.

**Regla para el futuro**: cualquier política RLS que necesite "¿este usuario pertenece al
mismo grupo que esta fila?" sobre una tabla de membresía debe pasar por una función
`SECURITY DEFINER`, nunca hacer un subquery directo contra la misma tabla que lleva la
política.

## Panel de administración web — completado y verificado (sesión 2, 2026-09-02)

Proyecto Next.js 16 (App Router, Turbopack, React 19) en `admin/`, dependencias propias
(`admin/node_modules`, `admin/package-lock.json`, no comparte instalación con la app Expo).

- **Auth**: login/signup con Supabase Auth (email/password, tabla `auth.users` — separado
  de las sesiones anónimas que usa la app móvil). `/login` y `/signup` son las únicas rutas
  públicas; `src/proxy.ts` (antes `middleware.ts` — Next 16 renombró la convención) redirige
  a `/login` si no hay sesión, y a `/` si ya hay sesión y se visita una ruta pública.
- **Gate de admin**: `src/lib/admin.ts` (`requireAdmin()`) verifica `users.is_admin` para
  el usuario autenticado en cada página protegida; si no es admin muestra "Acceso no
  autorizado" en vez de la data.
- **Alta de festival**: formulario en `/festivals/new` (nombre, ciudad, fechas, link de
  boletos opcional) → inserta en `festivals`.
- **Importación de line-up vía CSV**: en el detalle de cada festival (`/festivals/[id]`),
  parseo client-side con `papaparse` (columnas `artista` obligatoria, `escenario`/`horario`
  opcionales), preview en tabla antes de confirmar, luego insert en `festival_lineup`.
  También permite editar el link de boletos y quitar artistas del line-up individualmente.
- **Verificado en navegador de punta a punta** (no solo compilado): signup → confirmación
  de email (forzada por SQL para la cuenta bootstrap, ver abajo) → login → crear festival →
  importar CSV de 3 artistas (parseo correcto, preview correcto, insert correcto) → editar
  link de boletos (guardado confirmado) → quitar un artista del line-up (bajó de 3 a 2
  filas). Festival y line-up de prueba (`Festival de Prueba QA`) limpiados de la base al
  terminar — el `ON DELETE CASCADE` de `festival_lineup.festival_id → festivals.id` borró
  las filas de line-up automáticamente al borrar el festival (confirmado con un `count`).
- **Cuenta admin bootstrap creada**: `clauliz.acosta@gmail.com` en `auth.users`, con fila
  en `public.users` con `is_admin = true` (migración `bootstrap_admin_user`). Contraseña
  temporal generada y entregada en el chat de la sesión — **cámbiala desde Supabase Auth
  antes de compartir acceso al panel**, no quedó guardada en ningún archivo del repo.
- **Cómo correr el panel**: `cd admin && npm run dev` (usa `admin/.env.local`, no
  versionado, con `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`). También
  registrado en `.claude/launch.json` como configuración `"admin"` para abrirlo con el
  Browser tool. RLS ya restringe todo insert/update/delete en `festivals`/`festival_lineup`
  a `users.is_admin = true` — el rol `anon` del panel solo puede escribir si la sesión
  logueada tiene ese flag.
- **Botón "Comprar boletos"** (app móvil, ya implementado antes de esta sesión, sin
  cambios): funcional vía `Linking.openURL`. Ahora que el panel admin existe, ya se le
  puede cargar un link real a un festival editando su `link_boletos` desde
  `/festivals/[id]` — sigue pendiente cargar festivales/links reales (los 3 sembrados
  siguen con `link_boletos` de ejemplo, `example.com`).

## Festival Hub: line-up + RLS de no-admin — completado y verificado (sesión 3, 2026-09-02)

Trend del día y playlist del día ya estaban completos desde la sesión 1 (confirmado
releyendo `useTrendStore.ts`/`usePlaylistStore.ts` y el `pg_cron` activo — no se tocaron).
El trabajo de esta sesión fue: mostrar el line-up importado por CSV dentro de la app móvil
(no existía antes) y verificar de punta a punta el Festival Hub como usuario normal.

- **Line-up en `FestivalHubScreen`** ([FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx)):
  cada tarjeta de festival ahora tiene un toggle "▸ Line-up (N)" que expande la lista de
  artistas (nombre, escenario, horario formateado) traída de `festival_lineup`. Antes esta
  tabla no se consultaba desde la app — solo existía en el admin panel.
  `useFestivalStore.fetch` ([useFestivalStore.ts](src/store/useFestivalStore.ts)) ahora
  también trae `festival_lineup` filtrado por los festivales visibles y lo adjunta a cada
  `FestivalWithIntent.lineup`.
- **Rama de UI para `status === 'error'`** agregada en `FestivalHubScreen` (antes, un error
  de RLS/red dejaba la pantalla en blanco sin ningún mensaje — el mismo patrón que causó
  que el bug de RLS recursiva pasara desapercibido en la sesión 1; ahora se ve un mensaje).
- **Verificado en emulador de punta a punta como usuario normal** (sesión anónima real, no
  admin): navegar Home → Festival Hub, expandir line-up de "Festival Nocturno" (3 artistas,
  coincide con lo sembrado), tocar "Voy" → cambia visualmente a seleccionado **y** persiste
  en `festival_intent` (confirmado por SQL: fila con `status='voy'`, `updated_at` reciente,
  para un `user_id` con `is_admin=false`), tocar "Comprar boletos" → abre Chrome en el
  emulador (confirma que `Linking.openURL` se dispara; Chrome consumió la URL en su propio
  flujo de primer uso por ser la primera vez que se abre en este emulador — no es un bug de
  la app, solo impidió ver la URL final en la barra de direcciones).
- **RLS de escritura para no-admin confirmada** dos formas: (1) a nivel de política — las
  únicas policies de INSERT/UPDATE/DELETE en `festivals` y `festival_lineup` exigen
  `users.is_admin = true` (`festivals_insert_admin`, `festival_lineup_insert_admin`, etc.),
  no existe ninguna policy que permita escritura a un usuario normal; (2) el usuario de
  prueba que sí pudo escribir su propio `festival_intent` tiene `is_admin = false` en la
  fila de `public.users` — confirma que `festival_intent` (Voy/Tal vez/No voy) es la única
  tabla de festival donde un usuario normal puede escribir, y solo su propia fila.
- **Squads**: sigue sin confirmarse el flujo de crear/unirse (ver "Pendiente" abajo) — no
  se tocó esta sesión, el bloqueo documentado en la sesión 1 (teclado) no se volvió a
  investigar porque el foco de esta sesión era Festival Hub.

### Nota sobre el emulador en esta sesión

El emulador tuvo **ANRs reales y reproducibles** ("Expo Go isn't responding",
"Application Not Responding: com.android.chrome") en varios puntos, no solo con Expo Go
sino también con Chrome — confirma que es un problema del entorno (recursos del emulador),
no del código de la app, consistente con lo ya documentado en "Problemas de entorno". Lo
que funcionó de forma confiable para diagnosticar y avanzar pese a esto:
- `adb shell uiautomator dump` para obtener las coordenadas **reales** de los elementos en
  pantalla en vez de estimarlas a ojo desde una captura (las capturas se ven a una escala
  distinta a la resolución real del framebuffer, y estimar a ojo lleva a tocar el elemento
  equivocado).
- Correr Metro **sin** `CI=1`: con `CI=1` el banner "Bundling 100.0%..." se queda pegado en
  pantalla indefinidamente y parece bloquear los toques — quitar `CI=1` resolvió eso (Metro
  normal sí requiere responder al prompt de puerto en uso si el puerto ya está tomado, así
  que primero hay que liberar el puerto o correr `npx expo start --port <otro>`).
- Cuando la app deja de responder a los toques: `adb shell am force-stop host.exp.exponent`
  seguido de `adb shell am start -a android.intent.action.VIEW -d "exp://<ip>:<puerto>"
  host.exp.exponent` para relanzarla limpia contra el Metro que sigue vivo (no hace falta
  reiniciar Metro, solo la app).

## Pendiente del Sprint 2

- Cargar festivales y line-ups **reales** desde el panel admin (los 3 sembrados siguen
  siendo ficticios con links `example.com`) — el panel ya soporta hacerlo, solo falta
  hacerlo.
- No hay UI para editar nombre/ciudad/fechas de un festival ya creado desde el panel (solo
  alta y edición del link de boletos) — si hace falta, agregar un form de edición en
  `/festivals/[id]`.
- El panel no tiene forma de promover a otro usuario a admin desde la UI (hoy requiere
  SQL directo, `update public.users set is_admin = true where id = ...`) — si se necesita
  dar acceso a más de una persona, considerar una pantalla simple de gestión de admins.
- Confirmar visualmente el flujo completo de crear/unirse a un squad (bloqueado por el bug
  de teclado del emulador documentado en la sesión 1 — no se reintentó en la sesión 3).
- El invite code de squad se puede compartir hoy solo como texto plano vía `Alert` (no abre
  share sheet nativo) — ver "Decisiones técnicas" para el porqué; podría mejorarse a un
  share sheet real de solo-texto en vez de un Alert.

## Decisiones técnicas tomadas en el camino (no estaban en el prompt original)

- **Auth del panel admin es email/password, separada de las sesiones anónimas de la app**:
  la app móvil usa `signInAnonymously()` (ver `src/lib/supabase.ts`), así que ningún usuario
  tenía email ni forma de "iniciar sesión" desde una web. Se decidió con el usuario (no
  automáticamente) usar signup real de Supabase Auth para el panel — cuenta separada del
  concepto de "usuario de la app". El campo `users.is_admin` es el puente: cualquier fila en
  `public.users` (sea de sesión anónima o de esta auth nueva) con ese flag puede administrar.
- **`src/proxy.ts` en vez de `middleware.ts`**: Next.js 16 renombró la convención de
  middleware a "proxy" (`npx @next/codemod middleware-to-proxy` es el migrador oficial); se
  usó el nombre nuevo directamente para no arrancar con una convención deprecada.
- **Tipos de Supabase escritos a mano** (`admin/src/lib/database.types.ts`) en vez de
  generados con `generate_typescript_types`, porque el panel solo toca 3 tablas
  (`users`, `festivals`, `festival_lineup`). Ojo si se agregan más tablas al panel: el tipo
  `Database` de `@supabase/supabase-js` v2.114+ exige `__InternalSupabase.PostgrestVersion`
  y `Relationships: []` en cada tabla o la inferencia de tipos colapsa silenciosamente a
  `never` en every `.from(...)` (mensajes de error confusos tipo "Property X does not exist
  on type 'never'" sin mencionar la causa real).

- **SDK de Expo bajado de 57 a 54**: el Expo Go del teléfono del usuario solo soporta SDK 54.
  Se bajaron todas las dependencias con `expo install --fix`.
- **Invite de squad por código, no por deep link**: los deep links con esquema propio no
  abren la app corriendo bajo Expo Go (solo funcionan en builds standalone/dev-client). Se
  optó por un código de 6 caracteres que se comparte como texto y se pega manualmente —
  funciona igual de bien y es testeable hoy.
- **Compat score de squad tiene dos números distintos, a propósito**:
  - `squad_members.compat_score` (columna en DB, mantenida por trigger): promedio de
    similitud de un miembro contra el resto del squad. Se muestra como "compat. con el
    squad" y se promedia para el score general del squad.
  - "X% contigo" (calculado en el cliente, `src/lib/compat.ts`, mismo algoritmo coseno):
    comparación específica entre el usuario que está viendo la pantalla y cada otro
    miembro — no se puede guardar en una sola columna por fila porque depende de quién
    mira, así que se recalcula en el cliente con los datos ya cargados (barato, sin
    round-trip extra).
- **Playlist**: catálogo propio con contenido 100% ficticio (nombres de canciones/artistas
  inventados) — no se usaron nombres reales para evitar cualquier problema de atribución,
  ya que la integración real con Spotify está fuera de alcance de este sprint.
- **Trend del día**: se implementó con una función SQL + `pg_cron` en vez de una Edge
  Function con HTTP (el prompt decía "puede ser una Edge Function con cron", dejando
  abierta la opción) — más simple, sin salir de Postgres, y pg_cron ya estaba disponible
  en el proyecto.
- **Imágenes de la playlist/quiz/arquetipos**: redimensionadas con `sharp` (instalado en un
  proyecto npm aparte en scratchpad, no en el repo) a tamaños acordes a dónde se muestran
  (700px para tiles grandes, 220px para íconos, 160px para thumbnails, 380px para tarjetas
  de arquetipo) — el set original de 1024×1024 sin comprimir tardaba visiblemente en cargar
  en red real (reportado por el usuario).

## Problemas de entorno (no son bugs de la app)

- El emulador Android (Pixel_8, AVD local) tuvo repetidos episodios de "System UI isn't
  responding" y, en la sesión final, un bug donde el teclado en pantalla dejaba de tomar
  foco en cualquier `TextInput` (confirmado con `adb shell dumpsys input_method`: el
  foco quedaba pegado en una vista no relacionada, sin importar cuántas veces se
  reintentara o se reiniciara la app). Los botones/Pressables sí funcionaban con
  normalidad — solo el teclado estaba afectado. Esto bloqueó la prueba en vivo de
  "Crear un squad" (requiere escribir texto). No se detectó ningún problema equivalente
  en el teléfono físico del usuario en pruebas anteriores de esta misma sesión.
- La sesión también sufrió varias interrupciones/reinicios del entorno (procesos en
  background — emulador, Metro — murieron entre turnos sin aviso limpio) que obligaron a
  relanzar todo varias veces.

## Cómo retomar

1. App móvil: `npx expo start` desde la raíz del proyecto (usa el `.env` ya configurado).
   Emulador: `Pixel_8` AVD ya existe (`emulator -avd Pixel_8`), o usar el teléfono físico
   con Expo Go (mismo QR/URL de siempre mientras Metro corra en la misma red).
2. Panel admin: `cd admin && npm run dev` (o usar el Browser tool con la config `"admin"`
   de `.claude/launch.json`), entrar en `/login` con `clauliz.acosta@gmail.com` — cambiar
   la contraseña temporal desde Supabase Auth antes de compartir acceso.
3. Siguiente foco sugerido: revisar si el flujo de crear/unirse a squad funciona en un
   entorno con teclado sano (el código no cambió desde que se probó parcialmente en la
   sesión 1), y cargar festivales/line-ups reales desde el panel admin en vez de los datos
   de ejemplo. Festival Hub (line-up, Voy/Tal vez/No voy, boletos) ya quedó verificado de
   punta a punta en la sesión 3.
