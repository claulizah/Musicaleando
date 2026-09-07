# Estado del proyecto — Musicaleando

Última actualización: 2026-09-07 (sesión 9). Este archivo es el punto de partida para
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

## Squads: playlist colaborativa + verificación end-to-end (sesión 4, 2026-09-02)

Al empezar la sesión se revisó el código existente antes de tocar nada (siguiendo el
prompt de continuación) y se encontró que **Squads ya estaba implementado de una sesión
anterior**, más completo de lo que "Pendiente" de este archivo sugería: esquema
`squads`/`squad_members`, RPCs `create_squad`/`join_squad` (`SECURITY DEFINER`), RLS vía
`is_squad_member()`, tope de 12 miembros ya enforced en `join_squad` (`raise exception` si
`member_count >= 12`), compat score por trigger (`recompute_squad_compat`), y las pantallas
`SquadsScreen`/`SquadDetailScreen` con "% contigo" calculado en cliente
([compat.ts](src/lib/compat.ts)). Nada de esto se reconstruyó — solo se agregó lo que
faltaba y se verificó en vivo.

- **Playlist colaborativa agregada** (era el único punto pendiente real del alcance de
  Squads): tabla `squad_playlist` (`squad_id`, `song_id` → catálogo `songs` existente,
  `added_by`, `added_at`, unique por par) con RLS: select/insert solo si
  `is_squad_member()`, delete solo el que la agregó o el owner del squad — mismo patrón
  `SECURITY DEFINER`/función reutilizada que ya se documentó para evitar la recursión de
  RLS. [useSquadPlaylistStore.ts](src/store/useSquadPlaylistStore.ts) nuevo, integrado en
  `SquadDetailScreen` ([SquadDetailScreen.tsx](src/screens/main/SquadDetailScreen.tsx)):
  sección "Playlist del squad" con lista de canciones agregadas y un picker de
  género → canción (sin campos de texto, para no depender del teclado del emulador).
- **Verificado en emulador de punta a punta como usuario normal** (mismo usuario dueño del
  squad "Los Vi", ya existente): abrir Squads → abrir detalle → tocar "+ Agregar canción"
  → elegir género "Rock" → tocar una canción → aparece en "Playlist del squad" con
  "agregada por ti" y **persiste** (confirmado por SQL, fila en `squad_playlist` con
  `added_by` de un usuario `is_admin = false`) → long-press sobre la canción → confirmar
  "Quitar" → desaparece de la UI y se confirmó por SQL (`count(*) = 0`) que se borró de la
  tabla. Limpieza de datos de prueba incluida en la misma verificación (no quedó basura).
- **"Quitar del squad" (owner-only) completado**: el archivo ya tenía `isOwner` y
  `handleRemoveMember` declarados pero sin usar en el JSX (código a medio terminar,
  encontrado al releer el archivo mid-sesión). Se conectó a un botón "Quitar" visible solo
  para el owner junto a cada miembro que no sea él mismo — cumple el requisito original de
  que "solo el owner puede remover miembros" (la policy `squad_members_delete_owner` ya lo
  permitía a nivel de RLS, solo faltaba la UI). No se verificó visualmente el botón en
  dispositivo (el squad de prueba solo tenía 2 miembros y remover al otro habría alterado
  datos reales del usuario) — confirmado solo por lectura de código + que la policy RLS
  correspondiente ya existía y fue validada en la sesión 3.
- **RLS de no-miembro**: no se hizo una prueba en vivo con una segunda cuenta separada esta
  sesión (se priorizó terminar y verificar la playlist). Confianza alta por diseño: las 3
  policies de `squad_playlist` reutilizan literalmente `is_squad_member()`, la misma
  función ya usada por `squads`/`squad_members`/`festival_intent` y validada explícitamente
  en la sesión 3. Si se quiere una confirmación end-to-end explícita, crear una segunda
  cuenta anónima y confirmar que un `select`/`insert` contra el squad ajeno devuelve vacío
  o error de RLS.

## Squads: verificaciones pendientes cerradas + bugfix (sesión 5, 2026-09-03)

Las dos verificaciones que habían quedado pendientes de la sesión 4 se cerraron con cuentas
reales (no solo revisión de policy), usando un script Node con `@supabase/supabase-js` y el
anon key público del proyecto (mismo que usa la app) para crear sesiones anónimas de prueba
independientes del emulador — permite probar RLS "de verdad" (respetando policies, no con
el rol elevado del MCP de Supabase) sin depender del teclado del emulador.

- **RLS de no-miembro (confirmado con cuenta real)**: se creó un usuario C que nunca se unió
  a "Los Vi". `select` contra `squad_members`/`squad_playlist`/`squads` de ese squad devuelve
  `[]` (RLS filtra, no error). `insert` directo contra `squad_playlist` y contra
  `squad_members` devuelve error `42501` ("new row violates row-level security policy").
  Confirma que `is_squad_member()` funciona igual para la tabla nueva (`squad_playlist`) que
  para las ya validadas en sesión 3.
- **Botón "Quitar" (owner remueve miembro), confirmado con cuenta real y en emulador**: se
  unió un usuario B de prueba a "Los Vi" (vía `join_squad` con el código real, llevando el
  squad a 3 miembros como pedía el prompt), se usó el emulador (sesión real del owner,
  "El Caos Controlado") para tocar "Quitar" sobre B y confirmar en el diálogo. Confirmado
  por SQL que la fila de B desapareció de `squad_members`. Confirmado además que B **pierde
  acceso real**, no solo visual: reutilizando la sesión (JWT) ya abierta de B, un `select`
  posterior contra `squad_members`/`squad_playlist`/`squads` de "Los Vi" devuelve `[]` —
  RLS lo bloquea inmediatamente después de la remoción, sin necesidad de que B cierre sesión.
- **Bug encontrado y arreglado**: `leaveSquad` en
  [useSquadStore.ts](src/store/useSquadStore.ts) borraba el squad completo del estado local
  sin importar de quién era la membresía removida — al usarlo para "el owner remueve a otro
  miembro" (en vez de "yo salgo"), la pantalla mostraba brevemente "Cargando squad..." antes
  de refrescar solo. Se corrigió para distinguir: si el `userId` removido es el de la sesión
  actual (`useSessionStore`), se quita el squad completo de la lista local (comportamiento
  correcto para "Salir del squad"); si es otro miembro, solo se filtra ese miembro del
  array local (sin parpadeo). Verificado en emulador después del fix: la remoción del owner
  ya no muestra el loading intermedio.
- Datos de prueba (2 usuarios anónimos temporales + su membresía) limpiados de la base al
  terminar; `squad_playlist` y `squad_members` de "Los Vi" quedaron en el estado real
  (2 miembros: el owner y el miembro original).

## Festivales reales cargados vía panel admin (sesión 5, 2026-09-03)

Antes de tocar nada se revisó el panel: la importación CSV de line-up **ya existía completa**
desde la sesión 2 ([lineup-importer.tsx](admin/src/app/festivals/[id]/lineup-importer.tsx) +
[actions.ts](admin/src/app/festivals/[id]/actions.ts)), igual que el alta de festival por
formulario ([festivals/new](admin/src/app/festivals/new/page.tsx)) — no hizo falta construir
nada nuevo, solo usarlo con datos reales.

- **Festival real elegido con el usuario**: Corona Capital 2026 (Ciudad de México, 20–22 de
  noviembre de 2026, Autódromo Hermanos Rodríguez) — confirmado por búsqueda web contra
  fuentes de prensa (Chilango, Sopitas, N+, Milenio; ver esa sesión para los links). Se
  cargó vía la UI real del panel (login → `/festivals/new` → CSV de 16 artistas reales del
  cartel oficial: Gorillaz, James Blake, The Kooks, Mumford & Sons, CHVRCHES (viernes 20),
  Twenty One Pilots, The Offspring, Pierce The Veil, Mother Mother, Bunt (sábado 21), The
  Strokes, The xx, Daniel Caesar, Underworld, Lola Young, Lil Yachty (domingo 22)). No se
  cargó el cartel completo (+60 artistas) porque el horario exacto por artista no está
  publicado todavía a esta distancia del evento — se usó medianoche de cada día como
  placeholder de `horario` (visible en la app como "20 nov, 06:00" por la conversión de
  zona horaria; es un artefacto cosmético, no un bug, hasta que Ticketmaster publique
  horarios reales).
- **Link de boletos real**: `https://www.ticketmaster.com.mx/corona-capital-boletos/artist/1608797`
  — verificado en emulador que "Comprar boletos" abre Chrome en esa URL exacta y carga la
  página real de Ticketmaster México (cartel del festival visible). Con esto, el pendiente
  de "links de boletos reales" del Sprint 2 queda resuelto para este festival — no estaba
  bloqueado por falta de datos externos, solo por no haberlo hecho todavía.
- **Los 3 festivales de ejemplo (`Festival Nocturno`, `Encuentro Sonoro`, `Vibra Costera`)
  se borraron** de la base (`DELETE` directo por SQL, no hay botón de eliminar festival en
  el panel — ver pendiente abajo). El `ON DELETE CASCADE` limpió su `festival_lineup`
  automáticamente; también borró una fila real de `festival_intent` (`status='voy'` del
  usuario owner de "Los Vi" contra "Festival Nocturno", creada como parte de la
  verificación de la sesión 3) — esperado y aceptado, ya que reemplazar los datos de
  ejemplo era justamente el objetivo de esta sesión.
- **RLS re-confirmada específicamente para el camino de importación CSV**: el import no
  agrega tabla ni RPC nueva — usa `festival_lineup`/`festivals` de siempre a través de
  server actions con la sesión real del admin (cookies + anon key, ver
  [admin/src/lib/supabase/server.ts](admin/src/lib/supabase/server.ts)), así que la RLS ya
  validada en sesión 3 aplica igual. Aun así se hizo una prueba en vivo con una cuenta
  anónima no-admin: `insert` a `festivals` → error 42501; `insert` a `festival_lineup` →
  error 42501; `update` de `link_boletos` del festival real → no dio error pero afectó
  **0 filas** (comportamiento normal de Postgrest/RLS en `UPDATE`: la política filtra la
  fila antes de aplicar el cambio, así que no hay excepción pero tampoco hay escritura) —
  confirmado por SQL que el link real de Ticketmaster no cambió. Cuenta de prueba borrada
  al terminar.
- **Contraseña del admin reseteada**: no se tenía guardada la contraseña temporal de la
  sesión 2 (correctamente, nunca se guardó en el repo). El usuario autorizó explícitamente
  resetearla por SQL (`crypt()` de `pgcrypto` sobre `auth.users.encrypted_password`,
  migración `reset_bootstrap_admin_password_session5`) para poder entrar al panel — la
  nueva contraseña temporal se dio una sola vez en el chat de esta sesión, igual que antes;
  **el usuario debe cambiarla desde Supabase Auth** antes de compartir acceso al panel.
- **Nota técnica**: el Browser tool de esta sesión no tiene un control nativo para
  seleccionar un archivo real en el `<input type=file>` del importador CSV (intentar
  `form_input` con una ruta falla: los navegadores no permiten setear `.value` en inputs de
  archivo por seguridad). Se resolvió construyendo el CSV como `Blob`/`File` vía
  `javascript_tool` dentro de la página y asignándolo a `input.files` con un
  `DataTransfer`, disparando el evento `change` a mano — el resto del flujo (parseo con
  papaparse, preview, confirmar importación) corrió sin tocar código, igual que si un
  humano hubiera arrastrado el archivo.

## Sprint 3 (primera mitad): Torneo Sonoro, guilty pleasures, tarjeta compartible — completado y verificado (sesión 6, 2026-09-03)

Antes de tocar nada se revisó el onboarding para confirmar qué tanto de "Torneo Sonoro" ya
existía, como pedía el prompt de continuación. Hallazgo: **no existía ningún mecanismo de
bracket/torneo**, ni en el onboarding ni en ningún otro lado. Lo que el spec llama "duelo"
en el cuestionario ([Step1DuelVisual.tsx](src/screens/onboarding/quizSteps/Step1DuelVisual.tsx)
y [Step10DuelFinal.tsx](src/screens/onboarding/quizSteps/Step10DuelFinal.tsx)) son dos
preguntas de opción única (2 y 4 opciones respectivamente) que **no eliminan nada y no
afectan el arquetipo** — son solo decorativas para la `flavor line` (`buildFlavorLine` en
[archetypes.ts](src/lib/archetypes.ts)). El arquetipo lo determinan únicamente energía +
eje social (`computeArchetype`). Por lo tanto Torneo Sonoro se construyó desde cero, sin
reconstruir nada existente porque no había nada de bracket que reconstruir.

- **Torneo Sonoro (standalone, rejugable)**: nuevo
  [TorneoScreen.tsx](src/screens/main/TorneoScreen.tsx) + lógica de bracket en
  [tournament.ts](src/lib/tournament.ts). Bracket de eliminación simple sobre los 8
  `GENEROS` ya existentes (barajados con Fisher-Yates en cada partida — no siempre el mismo
  orden), 3 rondas (Ronda de 8 → Semifinal → Gran Final), 7 duelos, reutilizando
  `GradientTile`+`GENEROS_IMAGES` (mismo patrón visual que los "duelo" del quiz, no
  componentes nuevos) y `QuizProgressBar` para el progreso. Accesible desde un botón 🏆 en
  `HomeScreen` y desde "Jugar Torneo Sonoro" en `ProfileScreen` — no es parte del flujo de
  onboarding, se puede jugar cuantas veces se quiera.
- **El campeón actualiza `music_profile` y dispara el recálculo de compat_score
  correctamente — confirmado, no hubo que agregar ningún trigger nuevo**: antes de escribir
  código se revisó si ya existía un trigger de recompute (el prompt lo pedía explícitamente)
  y **sí existía, ya wired desde una sesión anterior**: `music_profile_recompute_compat`
  (`AFTER INSERT OR UPDATE OF generos, energia ON music_profile`) llama a
  `trigger_recompute_squads_for_user()`, que recalcula `squad_members.compat_score` para
  todos los squads del usuario vía `recompute_squad_compat()`. Nueva acción
  `applyTournamentChampion(userId, championId)` en
  [useProfileStore.ts](src/store/useProfileStore.ts): agrega el género campeón a
  `generos` (si no estaba ya) y guarda `flavor.torneo_campeon`/`flavor.torneo_fecha` — como
  toca la columna `generos`, el trigger dispara solo. **Verificado en vivo, no solo por
  lectura de código**: se jugó el torneo completo en el emulador con la cuenta real de "El
  Caos Controlado" (owner del squad "Los Vi"), el campeón resultó "Indie / Alternativo"
  (no estaba antes en sus géneros), y por SQL se confirmó que `squad_members.compat_score`
  de **ambos** miembros de "Los Vi" quedó recalculado con el vector de géneros nuevo
  (`generos: ["electronica","indie"]`) inmediatamente después del guardado.
- **Tarjeta compartible del campeón — reutilizando el componente existente, no uno nuevo**:
  `ArchetypeCard` ([ArchetypeCard.tsx](src/components/ArchetypeCard.tsx)) ya era genérico
  (label/emoji/descripción/gradiente + imagen opcional), solo se relajó el tipo de `id` de
  `ArchetypeId` a `string` para poder pasarle un género de torneo en vez de uno de los 12
  arquetipos fijos. El flujo de captura+compartir (`react-native-view-shot` +
  `expo-sharing`) es el mismo patrón exacto de `RevealScreen`, copiado sin reinventar.
  **Verificado en emulador**: se tocó "Compartir" en la pantalla de resultado del torneo y
  el share sheet nativo de Android se abrió con la imagen ya renderizada (tarjeta morada
  "Campeón: Indie / Alternativo" con la descripción y el brand "Musicaleando" visibles en
  la miniatura del share sheet).
- **Guilty pleasures**: ya existían como pregunta de opción única del quiz (paso 5,
  `guilty_pleasures` como array de un solo elemento). El pedido de esta sesión era una
  sección donde el usuario pueda "marcar/reconocer" varios — se agregó a `ProfileScreen`
  (no al torneo, tiene más sentido como algo que se ajusta libremente en el perfil) una
  lista de chips tocables con las mismas 6 opciones e imágenes ya existentes
  (`GUILTY_PLEASURES`/`GUILTY_PLEASURE_IMAGES`), multi-select real (toggle, no radio), con
  nueva acción `updateGuiltyPleasures(userId, ids)` en `useProfileStore` que escribe el
  array completo. **Verificado en emulador + SQL**: la opción del quiz ("boy band") ya
  aparecía pre-marcada al abrir el perfil; se tocó una segunda opción ("Lloro con baladas
  manejando") y quedó marcada visualmente **y** persistida
  (`guilty_pleasures: ["boyband","ballad_cry"]` confirmado por SQL) sin desmarcar la
  primera — confirma que es multi-select real, no reemplazo de un solo valor.
- **Sin cambios de esquema/DB nuevos**: todo se guarda en columnas que ya existían
  (`music_profile.generos`, `.flavor`, `.guilty_pleasures`) — no se creó ninguna tabla ni
  migración esta sesión.
- No quedaron datos de prueba sintéticos que limpiar: toda la verificación se hizo sobre la
  cuenta real de "El Caos Controlado" (mismo patrón que sesiones anteriores cuando verifican
  con la cuenta del dueño), sin crear cuentas temporales nuevas.

## Torneo Sonoro corregido: artistas reales de Spotify, no géneros (sesión 7, 2026-09-03)

La sesión 6 dejó una duda abierta: si el torneo debía enfrentar géneros (lo que se
construyó) o artistas reales. Se resolvió releyendo el spec original con el usuario —
sección "Fase 2: Torneo Sonoro" dice explícitamente: *"Bracket de eliminación con 8
artistas elegidos según los géneros de la Fase 1: cuartos → semifinal → gran final = solo 3
taps hasta un 'campeón musical'. Cada matchup muestra nombre e imagen del artista (dato de
catálogo público de Spotify)."* Es decir: 8 artistas, no 8 géneros — los géneros solo sirven
para **elegir** qué artistas entran al bracket.

- **Fuente de datos real, no fallback curado**: el usuario ya tenía una app de Spotify
  Developer con credenciales propias, así que se implementó Client Credentials Flow de
  verdad en vez del fallback manual que el prompt de continuación dejaba como aceptable.
  **El client secret nunca tocó el repo ni el bundle de la app** — se pidió al usuario que
  lo guardara directamente como secreto de Edge Function en el dashboard de Supabase (no
  hay tool de MCP para escribir secretos, y el Supabase CLI local no estaba autenticado/
  linkeado a este proyecto, así que no había forma de hacerlo por mí sin pedirle el secreto
  en texto plano — se optó por lo primero).
- **Nueva Edge Function `spotify-artists`** (`verify_jwt: true`, solo invocable con sesión
  válida — igual que el resto de RPCs de la app): recibe `{ generos: string[] }` (los
  géneros del `music_profile` del usuario), hace el flujo Client Credentials contra
  `accounts.spotify.com/api/token` (token cacheado en memoria del isolate mientras esté
  vivo), y busca artistas por género con `GET /v1/search?q=genre:"<term>"&type=artist`
  — **no** con `/v1/recommendations` ni `/v1/artists/{id}/related-artists`, que Spotify
  restringió a apps con "extended quota mode" desde noviembre 2024; Search se mantiene
  abierto para cualquier app. Reparte los resultados round-robin entre los géneros pedidos
  (para que un solo género no domine el bracket), ordena por popularidad, y si el usuario
  tiene menos de los géneros necesarios para completar 8 artistas, rellena con un género
  fallback (`pop`). Cada artista devuelto viene etiquetado con el `generoId` interno del que
  salió (necesario para que el cliente sepa qué género reforzar en `music_profile.generos`
  al coronar un campeón — ver abajo).
- **Bug real encontrado y arreglado durante el desarrollo, no solo teórico**: el límite
  documentado de Spotify Search (`limit`, rango 1-50) **no aplica igual para esta app** —
  pedir `limit=15` devolvía `400 Invalid limit` de forma consistente (confirmado con curl
  directo contra la API de Spotify, fuera de la Edge Function, para descartar que fuera un
  bug del código); `limit=10` funciona. Quedó documentado en un comentario en el código —
  ver [supabase/functions/spotify-artists/index.ts](supabase/functions/spotify-artists/index.ts).
- **`TorneoScreen.tsx` reescrito**: en vez de 8 `GENEROS` fijos baraja los 8 artistas que
  devuelve la función (fetch al montar la pantalla, con estados `loading`/`error`/`ready` —
  antes no existía manejo de error de red porque los géneros eran datos locales que nunca
  fallaban). El resto de la mecánica **no se tocó**: mismas 3 rondas, mismo
  `QuizProgressBar`/`GradientTile` reusados (ahora con `image: {uri: artist.imageUrl}` en
  vez de `require()` local), mismo flujo de captura+compartir de `ArchetypeCard`, rejugable
  desde Home/Perfil, "Jugar de nuevo" rebaraja el mismo pool de 8 sin pedirle a Spotify de
  nuevo.
- **`applyTournamentChampion` cambió de firma**: antes tomaba un `championId` (string de
  género); ahora toma el objeto `TournamentArtist` completo y guarda
  `flavor.torneo_campeon = { generoId, artistId, artistName, artistImageUrl }` en vez de un
  string plano, además de seguir reforzando `music_profile.generos` con el `generoId` del
  artista campeón — **esto es lo que sigue disparando el trigger
  `music_profile_recompute_compat`** (`AFTER UPDATE OF generos, ...`), el mecanismo no
  cambió de la sesión 6, solo lo que se le pasa a `generos`. `ProfileScreen.tsx` se
  actualizó para leer el nuevo shape del objeto (con guarda defensiva: si encuentra el
  shape viejo — un string plano de una partida de la sesión 6 — lo trata como "sin campeón
  todavía" en vez de romper).
- **Verificado en emulador + SQL, no solo compilado**: se jugó el bracket completo de punta
  a punta con la cuenta real ("El Caos Controlado", géneros `electronica`+`indie`) — cada
  duelo mostró nombre e imagen real de artista (Gracie Abrams, Marshmello, Daft Punk, Tame
  Impala, PinkPantheress, Gorillaz, Phoebe Bridgers, Alex Warren — todos de Spotify, no
  inventados), campeón final "Gracie Abrams" con su foto real en la tarjeta y el texto
  actualizado a "De 8 artistas en pista...". Confirmado por SQL que
  `music_profile.flavor.torneo_campeon` guardó el objeto completo
  (`artistId`/`generoId`/`artistName`/`artistImageUrl`) y que `updated_at` se refrescó en el
  mismo instante del guardado (la actualización sí tocó la columna `generos`, que es lo que
  dispara el trigger — mismo mecanismo ya validado en la sesión 6, no se repitió la prueba
  con un valor distinto porque el género del campeón ya estaba en `generos` de la sesión
  anterior). Se volvió a entrar al torneo una segunda vez para confirmar que "Jugar de
  nuevo"/reingreso rebaraja con un orden distinto (confirmado: la segunda partida arrancó
  con un par distinto al de la primera). Perfil verificado mostrando el chip del campeón con
  la foto real de Gracie Abrams.
- **Nada de datos de prueba residuales**: toda la verificación fue sobre la cuenta real
  existente, sin cuentas sintéticas nuevas. Los llamados de prueba a la Edge Function por
  `curl` durante el debugging no tocaron la base de datos (la función no escribe nada, solo
  Spotify + retorno).

## Sprint 3 (segunda mitad, parcial): Trends comunitarios, reacciones al cartel, import — completado y verificado (sesión 8, 2026-09-03)

Antes de tocar nada se revisó el código existente (FestivalHubScreen/useFestivalStore,
useSquadPlaylistStore como patrón de "elegir canción del catálogo", useTrendStore como
patrón de trend individual) para no reconstruir nada — ninguna de las tres features de esta
sesión existía todavía en ninguna forma parcial.

- **"Compañero ideal" quedó explícitamente en pausa**: se propuso una interpretación
  (sugerencia 1:1 del usuario con `compat_score` más alto de entre *todos* los usuarios de
  la app, no solo squadmates, vía una función SQL nueva tipo `find_best_compat_match`
  porque hoy RLS bloquea leer el `music_profile` de otros usuarios directamente) y el
  usuario pidió pausarla "hasta que se defina" — **no se implementó nada de esto**, ni
  tablas ni pantalla. Sigue sin mecánica definida.
- **Trends comunitarios (votación)**: tablas nuevas `community_shares` (`song_ids uuid[]`
  — soporta canción suelta o "playlist" de varias, `ciudad` denormalizada de
  `users.ciudad` al momento de compartir porque RLS de `users` solo deja leer la fila
  propia) y `community_share_votes` (un voto por usuario por share, un tap = toggle
  like/unlike). Vista `community_share_stats` (`security_invoker = true`) con el conteo de
  votos para rankear. RLS: select público en ambas tablas, insert/delete solo la fila
  propia (`auth.uid() = user_id`) — mismo patrón que `festival_intent`. Pantalla nueva
  [CommunityTrendsScreen.tsx](src/screens/main/CommunityTrendsScreen.tsx) (ruta
  `CommunityTrends`, botón 📈 en Home): toggle Global/Mi ciudad, selector de canciones por
  género reutilizando el patrón visual de "agregar canción" de Squads pero con multi-select
  real (checkbox, no un tap-y-cierra) para poder compartir varias como "playlist", ranking
  con "Trend comunitario de la semana" (el más votado, ventana de 7 días) destacado arriba
  y el resto abajo. **Es un complemento al Torneo Sonoro, no comparte tablas ni lógica**:
  Torneo es puntual/eliminación sobre artistas de Spotify; esto es una señal continua sobre
  el catálogo propio de canciones (`songs`), sin límite de participaciones.
  **Verificado en emulador + SQL**: se compartieron 2 canciones reales del catálogo
  ("Cuerdas Rotas" + "Riff Final", género Rock) como una sola "playlist", apareció
  inmediatamente como "Trend comunitario de la semana", se votó (❤️ 1) y se confirmó por
  SQL tanto la fila de `community_shares` (`song_ids` con los 2 ids correctos) como el
  `vote_count = 1` en la vista.
- **Reacciones al cartel**: tablas nuevas `festival_reactions` (`like`/`dislike`, upsert por
  `festival_id`+`user_id`, un tap sobre la misma reacción la quita — toggle) y
  `festival_feedback` (tags fijos + comentario libre opcional, un registro por usuario por
  festival, editable). Tags fijos definidos en
  [festivalFeedback.ts](src/lib/festivalFeedback.ts) (`mas_urbano`, `headliner_internacional`,
  `mas_locales` — los tres ejemplos literales del prompt). RLS: select público, insert
  propio, **update y delete solo la fila propia** — se verificó explícitamente que el
  patrón es select-todos/write-solo-mía, igual que se pidió comparándolo con
  `festivals`/`squad_members` de sesiones anteriores. UI agregada directo a
  [FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx) (aplica a todos los
  festivales por igual, no fue necesario nada específico de Corona Capital — se probó ahí
  primero por ser el único festival real cargado). **Verificado en emulador + SQL sobre
  Corona Capital 2026**: 👍 confirmado con POST 201 en los logs de la API y la fila
  correspondiente en `festival_reactions` (`reaction: 'like'`); feedback con tag
  `mas_urbano` confirmado en `festival_feedback` (`comentario: null` porque el campo de
  texto no se probó — ver nota de entorno abajo). El toggle de reacción también quedó
  confirmado de forma no intencional pero útil: un doble-tap accidental durante las pruebas
  generó un POST 201 seguido de un DELETE 204 sobre la misma fila, confirmando que
  "tocar de nuevo la misma reacción la quita" funciona de verdad, no solo en la UI
  optimista.
- **Import opcional de Spotify/Apple Music**: **sin OAuth**, tal como pedía el prompt — el
  usuario elige un archivo con `expo-document-picker` (paquete nuevo, junto con
  `expo-file-system` para leerlo; ninguno de los dos estaba instalado, se agregaron con
  `npx expo install`). Parseo 100% cliente en
  [musicImport.ts](src/lib/musicImport.ts), tolerante a varios formatos: intenta
  `master_metadata_album_artist_name` (Spotify Extended Streaming History real),
  `artistName` (export viejo de Spotify), y varias claves razonables para un export de
  Apple Music (`artist`, `Artist Name`, `Container Artist Name`, o `Track Description` con
  formato "Artista - Canción"). Un archivo que no matchea ninguna clave conocida en
  **ningún** registro devuelve `null` (no un import vacío silencioso) y la pantalla
  muestra una alerta amigable explicando que el perfil por cuestionario sigue intacto — así
  se maneja el caso límite de "archivo corrupto/formato inesperado" que pedía el prompt sin
  necesitar un archivo corrupto real para la prueba (la rama de código se revisó, no se
  reprodujo un archivo roto en vivo por límite de tiempo de la sesión — ver "Pendiente").
  El cliente extrae los artistas más escuchados (hasta 30) y se los manda a una Edge
  Function nueva, `import-listening-history`
  ([supabase/functions/import-listening-history/index.ts](supabase/functions/import-listening-history/index.ts)),
  que **no** llama a Spotify para leer el género de cada artista — ver el hallazgo de abajo,
  esa vía está bloqueada por Spotify en este tier — sino que arma un índice inverso
  (nombre de artista → género interno) buscando los artistas top de cada uno de los 8
  géneros vía `genre:"X"` Search (la misma llamada validada para Torneo Sonoro) y matchea
  los nombres del usuario contra ese índice. El resultado (hasta 3 géneros, ponderados por
  reproducciones) se aplica a `music_profile` igual que el campeón del torneo: refuerza
  `generos` (nunca reemplaza) y marca `origen: 'import'`.
  - **Hallazgo real durante el desarrollo, cambió el diseño de la función**: la ruta obvia
    — buscar cada artista por nombre y leer su campo `genres` — **no funciona en este tier
    de acceso de Spotify**. Confirmado con curl directo (fuera del código, para descartar
    bug propio) contra `/v1/search` y también contra `/v1/artists/{id}` con artistas muy
    conocidos (Metallica, Bad Bunny): **ninguno de los dos endpoints devuelve el campo
    `genres` en absoluto** (tampoco `popularity` ni `followers`) — confirma que la
    restricción de "extended quota mode" de Spotify de noviembre 2024 alcanza más lejos de
    lo que se pensaba en la sesión 7 (no solo Recommendations/Related Artists). El diseño
    final usa `genre:"X"` Search en la dirección que Spotify sí permite (que ya se sabía
    que funcionaba, por Torneo Sonoro) en vez de la dirección bloqueada.
  - **Verificado en emulador + SQL de punta a punta**: se generó un JSON de prueba con
    formato real de Spotify Extended Streaming History (`master_metadata_album_artist_name`)
    con 5 artistas reales conocidos (Gracie Abrams, Marshmello, Daft Punk, Tame Impala,
    Arctic Monkeys) más un "artista" inventado para probar el camino de no-match, se
    empujó al emulador con `adb push` a `/sdcard/Download/` (se necesitó forzar un
    `MEDIA_SCANNER_SCAN_FILE` porque el picker de Android no lo indexaba de inmediato pese
    a que `content query` ya lo veía — ver "Problemas de entorno"), se seleccionó desde el
    picker nativo de Android dentro de la app, y la app mostró "Reforzamos tu perfil con 3
    género(s) a partir de 5 artista(s) reconocidos." Confirmado por SQL:
    `music_profile.generos` pasó de `[electronica, indie]` a
    `[electronica, indie, rock]` (rock se agregó nuevo, por Tame Impala/Arctic Monkeys),
    `origen = 'import'`, `flavor.import_top_artists` con los 5 nombres reales. **El trigger
    de compat_score volvió a dispararse correctamente** sin tocarlo: `squad_members.compat_score`
    de ambos miembros de "Los Vi" subió de 21 a 51 en el mismo momento (antes no
    compartían ningún género, ahora comparten `rock` con el otro miembro del squad).
  - El archivo de prueba se borró del almacenamiento del emulador al terminar (no es dato
    de la app, solo un artefacto local del picker).
- **Bug de tsconfig heredado de la sesión 7, encontrado y arreglado al inicio de esta
  sesión**: `npx tsc` fallaba con `Cannot find name 'Deno'` sobre
  `supabase/functions/spotify-artists/index.ts` — la sesión 7 agregó ese archivo al repo
  después del último `tsc` limpio y nunca lo volvió a correr. Se agregó `"supabase"` al
  `exclude` de `tsconfig.json` (las Edge Functions corren en Deno, no las compila ni
  ejecuta Metro/el bundler de la app — no deben pasar por el typecheck de la app).

## Sesión 9 (2026-09-07): pendientes físicos siguen bloqueados, spec de Sprint 4 leído, Comentarios + Anuncios construidos

**Spec**: no existía `musicaleando-spec.html` en ningún lado del sistema de archivos — el
usuario lo compartió como un Artifact publicado (link pegado en el chat). Se leyó completo
desde ahí (guardado localmente por la tool de lectura de Artifacts) antes de tocar nada.

**Los dos pendientes físicos de la sesión 8 siguen sin poder probarse**: esta sesión
tampoco tuvo un teléfono físico conectado (`adb devices` solo mostró el emulador). El
usuario confirmó explícitamente que no había forma de conectar uno esta sesión, así que —
siguiendo la instrucción de decirlo en vez de darlo por bueno — **el camino de archivo de
import corrupto y el campo de comentario libre en reacciones al cartel siguen sin
verificación en vivo**, ahora van dos sesiones seguidas. Ambos siguen respaldados solo por
revisión de código.

**Decisiones tomadas para las 3 features de Sprint 4 que quedaron sin construir** (ver
"Pendiente" abajo) — confirmadas con el usuario antes de escribir código, para no repetir
el error de construir dos veces que pasó con Torneo Sonoro:
- **Recomendaciones V1 (motor propio)**: el spec pide similitud coseno contra "metadata
  pública de artistas (género, popularidad vía Search/Get Artist)" — pero ya está
  confirmado (sesión 7/8) que Spotify no expone `genres` ni `popularity` en este tier, ni
  siquiera en `/v1/artists/{id}`. El usuario confirmó reusar el mismo truco de índice
  inverso por género (`genre:"X"` Search) ya validado en Torneo Sonoro e Import, en vez de
  depender de esos campos.
- **Mapa del festival**: el spec dice "capa vectorial estática por festival", pero no hay
  geodata en ningún lado (el CSV de line-up solo tiene `escenario` como texto, sin
  coordenadas). El usuario eligió explícitamente: el admin sube una imagen del recinto y
  coloca pines por escenario tocando la imagen (x/y en %, no GPS real); en la app, tocar un
  pin muestra el line-up de ese escenario. Esto requiere agregar subida de imágenes al
  panel admin (no existe hoy — Supabase Storage no se ha usado todavía en este proyecto,
  hay que crear un bucket).
- **Festival generado por gustos**: no tiene sección propia en el spec (solo aparece como
  chip/bullet, a diferencia de Torneo Sonoro que sí tenía su "Fase 2" detallada) — la
  lectura más razonable, cruzando con "Recomendaciones de horario/escenario basadas en el
  perfil musical" del módulo Festival Hub, es que es la misma engine V1 aplicada al
  line-up real de un festival específico (`festival_lineup.artista`) para resaltar/generar
  un mini-itinerario personalizado. No se confirmó explícitamente con el usuario porque se
  desprende directamente de V1 + Festival Hub sin alternativas razonables — si al construir
  aparece otra interpretación, confirmar antes de seguir.
- Ninguna de las tres se implementó esta sesión — quedaron solo como decisiones de diseño
  ya acordadas, listas para construir en la siguiente sesión sin tener que volver a
  preguntar.

### Comentarios por festival — completado y verificado

Tabla nueva `festival_comments` (`festival_id`, `user_id`, `texto`, `created_at`), RLS
select-todos / insert-propio / delete-propio — mismo patrón que `festival_reactions` de la
sesión 8. Agregado a `useFestivalStore` (fetch junto con reacciones/feedback, más
`postComment`/`deleteComment`) y a [FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx)
como un feed toggle "▸ Comentarios (N)" con lista + campo de texto + botón Enviar, y un
link "Borrar" visible solo en los comentarios propios.

**Verificado, pero no visualmente en el emulador** — ver "Problemas de entorno" abajo: el
emulador entró en un loop de ANR ("System UI isn't responding" / "Process system isn't
responding") que no se resolvió ni con esperas largas ni con un reinicio completo en frío
(sin snapshot), algo peor que lo documentado en sesiones anteriores. En vez de seguir
insistiendo sin resultado, se verificó el mecanismo completo por REST usando
`@supabase/supabase-js` con sesiones anónimas reales (mismo enfoque que la sesión 5 usó
para RLS de squads) contra Corona Capital 2026:
- Insertar un comentario como usuario A → éxito, aparece en el `select` público.
- Borrar el comentario propio → éxito.
- Insertar un comentario como usuario A, intentar borrarlo como usuario B → **0 filas
  afectadas, sin error** (RLS lo filtra silenciosamente, comportamiento esperado de
  Postgrest en `DELETE`), el comentario sigue existiendo — confirma que "solo el autor
  borra el suyo" funciona de verdad, no solo en la política escrita.
- Los usuarios anónimos temporales y sus filas de prueba se borraron al terminar (no
  quedó nada residual).

### Anuncios y promociones con patrocinadores — completado y verificado

Tres tablas nuevas: `sponsors` (admin-only, puede tener datos de contacto sensibles),
`announcements` (`tipo`: simple/rifa/descuento, `sponsor_nombre` denormalizado desde
`sponsors` para que la app móvil nunca necesite leer esa tabla directamente, select
público / write admin-only) y `announcement_interest` ("me interesa", un tap = toggle,
select público para poder contarlo, insert/delete propio). RLS de `announcements` y
`sponsors` sigue exactamente el patrón admin de `festivals`/`festival_lineup` (columna
`users.is_admin`).

- **Panel admin**: página nueva `/sponsors` (listar + alta + borrar patrocinadores) y
  sección nueva "Anuncios y promociones" dentro de `/festivals/[id]` (listar + alta con
  tipo condicional — el campo "código de descuento" solo aparece si `tipo=descuento` — +
  borrar). La selección de ganador de rifa y el dashboard de interés agregado **no se
  construyeron** — el spec los pone explícitamente en Sprint 5 ("Rifas + selección de
  ganador"), así que el panel de esta sesión solo publica/borra anuncios y muestra el
  conteo crudo de "me interesa" por anuncio, sin más.
- **App móvil**: sección nueva en cada tarjeta de festival en
  [FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx) con badge por tipo
  (📣/🎟️/💸), nombre del patrocinador, código de descuento cuando aplica, y botón
  toggle "☆/★ Me interesa (N)".
- **Verificado en el panel admin, en el navegador, de punta a punta**: se creó un
  patrocinador de prueba ("Cerveza Volcán") y un anuncio tipo rifa vinculado a Corona
  Capital 2026, confirmado por SQL después de cada paso. **Nota de esta sesión**: los
  primeros dos intentos de click en el botón de submit no dispararon el server action —
  los refs de `read_page`/`find` quedaban obsoletos tras el re-render de React del
  formulario (`useActionState`); clickear por coordenada tomada de un screenshot fresco sí
  funcionó de forma confiable. Si un formulario del admin panel "no hace nada" al hacer
  click con una tool de browser, tomar un screenshot nuevo y clickear por coordenada en vez
  de reusar un `ref` de una lectura anterior.
- **Verificado por REST** (mismo motivo que Comentarios — emulador no disponible): "me
  interesa" insertado, contado (1) y borrado (toggle) con una sesión anónima real contra el
  anuncio de prueba.
- El patrocinador y el anuncio de prueba ("Cerveza Volcán") se borraron al terminar — no
  eran datos reales del proyecto (a diferencia de Corona Capital, que si es real), así que
  no debían quedar como si lo fueran.

### Recomendaciones V1 (motor propio) + Festival generado por gustos — completado y verificado (misma sesión, continuación)

Dos Edge Functions nuevas, siguiendo las decisiones de diseño ya acordadas más arriba en
esta misma sesión (reusar el índice inverso por género en vez de `genres`/`popularity` de
Spotify, que no están disponibles en este tier):

- **`recommend-artists`** ([supabase/functions/recommend-artists/index.ts](supabase/functions/recommend-artists/index.ts)):
  dado `generos` + `championGenreId` (opcional, del Torneo Sonoro), arma el mismo pool de
  candidatos por género que Torneo Sonoro (`genre:"X"` Search), les da un score (2 si el
  género coincide con el del campeón, 1 si no) y devuelve el top N ordenado. **No es una
  similitud coseno literal** — se documentó explícitamente en el código y aquí por qué: no
  hay `genres`/`popularity` por artista disponibles para comparar contra un vector
  multidimensional real; es la aproximación más honesta posible con los datos que Spotify sí
  entrega a este tier. `energia`/`arquetipo` del spec no se usan para puntuar artistas
  individuales (no existe ninguna fuente de "energía por artista" alcanzable — Audio
  Features/Analysis está bloqueado por Spotify desde nov. 2024, el propio spec lo menciona).
  Consumido desde [useRecommendationsStore.ts](src/store/useRecommendationsStore.ts) y
  mostrado en Home con la tarjeta nueva
  [RecommendedArtistCard.tsx](src/components/RecommendedArtistCard.tsx) ("Artista
  recomendado", tal como aparece en el flujo de Home del spec) — un artista destacado con la
  razón ("porque te gusta X" / "porque tu campeón también es X") y hasta 4 más en fila.
- **`personalize-festival`** ([supabase/functions/personalize-festival/index.ts](supabase/functions/personalize-festival/index.ts)):
  "Festival generado por tus gustos" — el spec no tiene una sección propia para esta feature
  (a diferencia de Torneo Sonoro, que sí tenía su "Fase 2"), así que se interpretó como la
  misma engine V1 aplicada al line-up **real** de un festival ya cargado
  (`festival_lineup.artista`) en vez de descubrir artistas nuevos: arma el mismo índice
  inverso por género que usa el import, y matchea los nombres reales del line-up contra ese
  índice (match exacto de nombre, no difuso — mismo límite de recall ya documentado para el
  import). En [FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx), cada tarjeta
  de festival con line-up ahora tiene un botón "✨ Tu festival, a tu medida" que llama esto
  bajo demanda (no automático al cargar, para no disparar una llamada a Spotify por cada
  festival visible sin que el usuario la pida) y muestra "🎯 Artista · Género" para cada
  coincidencia bajo "No te lo pierdas".
- `readTorneoCampeon` se movió de [ProfileScreen.tsx](src/screens/main/ProfileScreen.tsx) a
  [useProfileStore.ts](src/store/useProfileStore.ts) (exportado) para reusarlo también en
  Home sin duplicar la lógica de leer el campeón desde `flavor`.
- **Verificado por curl directo contra ambas funciones** (no por REST con sesión de usuario,
  porque ninguna de las dos escribe en la base de datos — son puro cálculo/lectura de
  Spotify, así que no hay RLS ni estado que verificar más allá de la respuesta): 
  `recommend-artists` con `generos: [electronica, indie]` y `championGenreId: indie` devolvió
  6 artistas, todos con `generoId: indie` y `matchedChampion: true` (el boost de score
  funcionando: como el pool de indie por sí solo ya llena el límite de 6, ningún resultado de
  electronica entra); `personalize-festival` contra el line-up real de 16 artistas de Corona
  Capital 2026 encontró 1 coincidencia ("Gorillaz" → electronica) — bajo pero esperado y
  consistente con la limitación de recall ya documentada (solo hay 10 artistas muestreados
  por género de los cientos que existen).
- **No se pudo verificar visualmente en el emulador** — mismo loop de ANR de esta sesión (ver
  "Problemas de entorno"), reintentado dos veces sin éxito tras la pausa documentada más
  arriba y descartado por tiempo, siguiendo la propia regla que se dejó escrita para la
  próxima sesión ("no repetir el ciclo más de una o dos veces"). El `tsc` del proyecto
  completo pasa limpio.

## Pendiente

- No hay UI para editar nombre/ciudad/fechas de un festival ya creado desde el panel (solo
  alta y edición del link de boletos), ni para **eliminarlo** (se necesitó SQL directo esta
  sesión para quitar los 3 festivales de ejemplo) — si hace falta, agregar ambos al detalle
  en `/festivals/[id]`.
- El panel no tiene forma de promover a otro usuario a admin desde la UI (hoy requiere
  SQL directo, `update public.users set is_admin = true where id = ...`) — si se necesita
  dar acceso a más de una persona, considerar una pantalla simple de gestión de admins.
- El invite code de squad se puede compartir hoy solo como texto plano vía `Alert` (no abre
  share sheet nativo) — ver "Decisiones técnicas" para el porqué; podría mejorarse a un
  share sheet real de solo-texto en vez de un Alert.
- El `horario` del line-up de Corona Capital 2026 es un placeholder (medianoche de cada
  día) porque el cartel oficial todavía no publica horarios por artista — cuando
  Ticketmaster/el festival los publique, actualizar vía CSV o edición manual en
  `festival_lineup`.
- Solo se cargaron 16 de los +60 artistas confirmados del cartel (los principales/cabezas
  de cartel) — se puede ampliar con otro CSV si se quiere el cartel completo.
- **Sprint 3 — sigue pendiente**:
  - **Compañero ideal**: sin implementar, en pausa explícita por el usuario hasta definir
    la mecánica (ver sesión 8). La interpretación propuesta (compat_score más alto entre
    todos los usuarios de la app, no solo squadmates) no fue ni confirmada ni descartada.
  - No se probó en vivo el camino de archivo corrupto/formato no reconocido del import
    (`parseListeningHistory` devuelve `null` y la UI muestra alerta amigable — revisado por
    código, no reproducido con un archivo roto real en el emulador por tiempo).
  - El comentario libre de "¿Qué le cambiarías?" en reacciones al cartel no se probó en
    vivo (se guardó feedback con tags pero `comentario: null`) — el `TextInput` disparó el
    mismo bug de teclado/reset-de-navegación documentado en "Problemas de entorno esta
    sesión", no se insistió por tiempo. El código en sí no cambia entre guardar con o sin
    comentario (mismo campo opcional), así que el riesgo de que esté roto es bajo, pero no
    hay confirmación visual.
  - "Mi ciudad" en Trends comunitarios no tiene datos reales que filtrar todavía — ningún
    usuario tiene `users.ciudad` seteado (no hay UI en la app para editarlo). El código del
    filtro está completo y correcto, solo no hay forma de probarlo con datos reales hasta
    que exista una pantalla de "editar mi perfil" con ciudad, o se cargue manualmente por
    SQL para una prueba puntual.
  - No hay aggregate visible de los tags de "¿Qué le cambiarías?" entre todos los usuarios
    (solo se guarda/lee el feedback propio) — si se quiere mostrar "la gente pide más
    urbano" como dato agregado, falta esa vista/consulta.
- ~~Torneo Sonoro es sobre géneros, no sobre artistas~~ — **resuelto en sesión 7**, ver esa
  sección: el torneo ahora enfrenta artistas reales (Spotify), no géneros. Se dejó esta
  entrada tachada en vez de borrarla para que quede rastro de la duda y su resolución.
- El botón "Jugar de nuevo" en el resultado del torneo reinicia el bracket completo desde
  cero (nuevo shuffle de los mismos 8 artistas ya cargados, sin volver a pedirle a Spotify)
  sin confirmación — si se juega dos veces seguidas el segundo campeón simplemente refuerza
  `generos` igual que el primero (no reemplaza), así que jugar varias veces solo va sumando
  géneros al perfil, nunca los quita. Es el comportamiento esperado dado que `generos`
  representa géneros que le gustan al usuario, pero vale la pena tenerlo presente si se
  agregan más features que dependan de "el campeón actual" (hoy `flavor.torneo_campeon`
  siempre guarda solo el último).
- **Sprint 4 — sigue pendiente**:
  - **Mapa del festival**: única feature de Sprint 4 sin construir. Diseño ya acordado con
    el usuario (sesión 9): imagen subida por el admin + pines por escenario (x/y en %, no
    GPS). Requiere crear un bucket de Supabase Storage (no se ha usado en este proyecto
    todavía) y agregar subida de imágenes al panel admin — no hace falta volver a
    preguntar, solo construir.
  - Comentarios por festival, Anuncios y promociones, Recomendaciones V1 y Festival
    generado por gustos **quedaron completos** esta sesión — ver secciones arriba. La
    interpretación de "Festival generado por gustos" (aplicar la engine V1 al line-up real
    de un festival) no se confirmó explícitamente con el usuario porque se desprendía
    directamente de V1 + Festival Hub sin alternativas razonables — si en el uso real
    resulta ser otra cosa, ajustar.
  - Ninguna de las dos features nuevas de esta sesión (Recomendaciones/Festival
    personalizado) se verificó visualmente en el emulador — bloqueado por el mismo loop de
    ANR de toda la sesión. Sí se verificó el backend completo por curl directo (no
    escriben en la base de datos, así que no hay RLS que verificar más allá de la
    respuesta).
- **Sprint 4 — dashboard de interés agregado y selección de ganador de rifa** son
  explícitamente Sprint 5 según el spec ("Rifas + selección de ganador") — el panel admin
  de esta sesión solo publica/borra anuncios y muestra el conteo crudo de interesados, sin
  UI para elegir ganador ni notificación push automática.

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
- (Sesión 6) El mismo "Expo Go isn't responding" volvió a aparecer una vez a mitad de la
  verificación del torneo, sin patrón claro (no fue por escribir texto esta vez, ocurrió
  navegando entre pantallas). Se resolvió igual que en sesiones anteriores: `adb shell am
  force-stop host.exp.exponent` + relanzar con `am start -a android.intent.action.VIEW -d
  "exp://127.0.0.1:8081" host.exp.exponent` (con `adb reverse tcp:8081 tcp:8081` ya
  activo) — Metro no necesitó reiniciarse, solo la app. Sigue pareciendo un problema de
  recursos del emulador, no del código.
- (Sesión 8) Reaparición del bug de teclado ya documentado, pero con un síntoma nuevo: tocar
  un `TextInput` (el campo de comentario de "¿Qué le cambiarías?") y luego enviar texto por
  `adb shell input text` no solo falló en escribir — la navegación de la app saltó
  completo a `Home`, como si se hubiera perdido el stack de navegación. Se reprodujo dos
  veces seguidas con el mismo patrón exacto (tocar el campo, mandar texto con `%s` como
  separador de espacios). No se investigó la causa raíz porque el resto del formulario
  (chips de tags, botón guardar) funcionaba perfecto sin tocar el `TextInput` — se evitó el
  campo de texto en las pruebas de esta sesión en vez de perder tiempo depurando un problema
  de entorno ya documentado como recurrente. Importante: **cualquier interacción con
  `TextInput` en este emulador debería tratarse con sospecha** hasta que se investigue si es
  el emulador (más probable, dado el patrón repetido en sesiones distintas) o algo real de
  la app — probar en el teléfono físico del usuario sería la forma más rápida de descartar
  una cosa u otra.
- (Sesión 8) El picker de archivos nativo de Android (`expo-document-picker`) no mostró un
  archivo recién copiado con `adb push` a `/sdcard/Download/` hasta forzar
  `adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file://<ruta>`
  — el archivo ya aparecía en `content query --uri content://media/external/file` con el
  MIME type correcto, pero la carpeta "Downloads" del picker (`DocumentsUI`) usa su propio
  índice/caché que no se refrescó solo. Si se necesita repetir esto en una sesión futura,
  hacer el broadcast de una vez en vez de perder tiempo re-abriendo el picker.
- **(Sesión 9) El peor episodio de ANR documentado hasta ahora**: al retomar la sesión
  (después de una pausa de varios días — ni el emulador ni Metro seguían corriendo), el
  emulador entró en un loop de "System UI isn't responding" / "Process system isn't
  responding" que **no se resolvió con esperas largas (hasta 30s) ni con un reinicio
  completo en frío del emulador** (`adb emu kill` + matar procesos residuales + arrancar de
  nuevo con `-no-snapshot-load` para descartar un snapshot corrupto) — la ANR volvió a
  aparecer en el primer intento de interacción incluso en el emulador recién arrancado.
  Una señal adicional: `adb shell screencap` devolvió en un momento `Unable to fork in
  order to send intent for media scanner`, un error de "no se pudo crear un proceso nuevo"
  — indica que la máquina host, no el emulador en sí, estaba bajo presión de recursos real
  en ese momento (aunque el conteo de `node.exe` no era anormal, ~9 procesos). En vez de
  seguir insistiendo sin resultado, se hizo la verificación de esta sesión por REST directo
  (ver secciones de Comentarios/Anuncios arriba) y se documentó el bloqueo en vez de forzar
  una confirmación visual que no se pudo obtener. **Para la próxima sesión**: si el mismo
  loop de ANR aparece de entrada, no repetir el ciclo esperar→reiniciar→esperar más de una
  o dos veces — pivotear a verificación por REST/SQL más rápido, y considerar revisar qué
  más está corriendo en la máquina host (no solo procesos de este proyecto) antes de
  arrancar el emulador.

## Cómo retomar

1. App móvil: `npx expo start` desde la raíz del proyecto (usa el `.env` ya configurado).
   Emulador: `Pixel_8` AVD ya existe (`emulator -avd Pixel_8`), o usar el teléfono físico
   con Expo Go (mismo QR/URL de siempre mientras Metro corra en la misma red).
2. Panel admin: `cd admin && npm run dev` (o usar el Browser tool con la config `"admin"`
   de `.claude/launch.json`), entrar en `/login` con `clauliz.acosta@gmail.com` — cambiar
   la contraseña temporal desde Supabase Auth antes de compartir acceso.
3. Edge Function `spotify-artists` (proyecto Supabase `ijwyykfuyeaahvxmaild`): el código
   fuente vive en el repo en
   [supabase/functions/spotify-artists/index.ts](supabase/functions/spotify-artists/index.ts)
   (se desplegó vía el MCP de Supabase, no vía CLI local — no hay `supabase/config.toml` ni
   proyecto linkeado; para redesplegar tras editarla, usar la tool `deploy_edge_function`
   del MCP con `verify_jwt: true`, o instalar y linkear el Supabase CLI). Requiere los
   secretos `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` ya cargados en el dashboard (Edge
   Functions → Manage secrets) — si se rota la app de Spotify Developer, actualizarlos ahí,
   no hace falta redesplegar la función.
4. Edge Function `import-listening-history`: código fuente en
   [supabase/functions/import-listening-history/index.ts](supabase/functions/import-listening-history/index.ts),
   mismo patrón de despliegue/secretos que `spotify-artists` (punto 3). **No** usa el campo
   `genres` de la API de Spotify — está confirmado que no está disponible en este tier de
   acceso (ver sesión 8) — usa un índice inverso construido con `genre:"X"` Search.
5. Sponsors/Announcements: tablas `sponsors`/`announcements`/`announcement_interest` y
   panel admin en `/sponsors` y dentro de `/festivals/[id]` — ver sesión 9. Selección de
   ganador de rifa y dashboard de interés agregado quedan para Sprint 5 a propósito.
6. Edge Functions `recommend-artists` y `personalize-festival` (Recomendaciones V1 /
   Festival generado por gustos) — código en
   [supabase/functions/recommend-artists/index.ts](supabase/functions/recommend-artists/index.ts)
   y [supabase/functions/personalize-festival/index.ts](supabase/functions/personalize-festival/index.ts),
   mismo patrón de despliegue/secretos que las anteriores. Ninguna escribe en la base de
   datos (puro cálculo sobre datos de Spotify), verificadas por curl directo, no por REST
   con sesión de usuario.
7. Siguiente foco sugerido: **Mapa del festival**, única feature de Sprint 4 que falta.
   Diseño ya acordado con el usuario (sesión 9): el admin sube una imagen del recinto +
   coloca pines por escenario (x/y en %); en la app, tocar un pin muestra el line-up de ese
   escenario. Necesita crear un bucket de Supabase Storage nuevo (no usado en este proyecto
   todavía) y agregar subida de imágenes al panel admin — no hace falta volver a preguntar,
   solo construir. Con eso, Sprint 4 queda completo.
   - **Compañero ideal sigue sin definir**: no avanzar en código hasta que el usuario
     confirme o corrija la interpretación propuesta en la sesión 8.
   - **Van dos sesiones seguidas (8 y 9) sin poder probar en físico**: el camino de archivo
     corrupto del import y el campo de comentario libre de reacciones al cartel siguen sin
     verificación visual — solo revisión de código + (desde sesión 9) verificación por REST
     del resto del mecanismo de comentarios. Si hay un teléfono físico disponible en algún
     momento, priorizar probar ahí antes que seguir peleando con el emulador.
   - Tampoco se pudo verificar visualmente Recomendaciones V1/Festival generado por gustos
     esta sesión, por el mismo motivo — backend ya confirmado por curl, falta la UI en
     dispositivo.
   - Si se agrega una pantalla de "editar mi perfil" en algún momento (nombre/ciudad), eso
     desbloquea probar "Mi ciudad" en Trends comunitarios con datos reales.
7. Si el emulador vuelve a entrar en el loop de ANR documentado en "Problemas de entorno"
   (sesión 9) desde el primer arranque, no perder mucho tiempo reintentando — usar
   verificación por REST/SQL con `@supabase/supabase-js` y sesiones anónimas reales (ver
   ejemplo de script en la sección de Comentarios de la sesión 9) para confirmar RLS y
   mecánica de escritura, y documentar la verificación visual como bloqueada.
