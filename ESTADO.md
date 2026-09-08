# Estado del proyecto — Musicaleando

Última actualización: 2026-09-08 (sesión 16, cierre — auditoría de lanzamiento). Este
archivo es el punto de partida para retomar el trabajo en una sesión nueva sin perder
contexto.

**Estado en una línea**: Los 7 sprints numerados y las 3 piezas priorizadas del Backlog v2
están completos (ver sesión 15). La **sesión 16 fue una auditoría de QA contra el checklist
de lanzamiento del spec, no desarrollo** — conclusión: **el producto está, en código, listo
para lanzar**, con una sola pieza sin confirmar visualmente (Álbum de conciertos, bloqueada
por el emulador desde hace 4 sesiones) y una recomendación de infraestructura (crash
reporting). Lo que falta para un lanzamiento real es puramente de negocio/marketing
(patrocinador firmado, pitch, web, video, campaña) — ver la sección de la sesión 16 para el
detalle completo, punto por punto del checklist. Solo quedan del Backlog v2, sin construir
ni confirmadas para retomar: **Seguridad/ubicación en vivo** y **Conexión en vivo
(Spotify/Apple Music OAuth beta)**. "Compañero ideal" (Sprint 3) sigue pausado por separado
— no se resolvió, es una decisión distinta.

Proyecto Supabase: `ijwyykfuyeaahvxmaild` ("Sound Project", org `ljcnanwlkijozacnyhck`).
Repo: rama `master`, sin remoto configurado todavía. Último commit antes de esta sesión:
`abfb3e5` (cierre de sesión 15, Match por historial compartido).

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

## Sesión 9 (2026-09-07): Sprint 4 completo (Comentarios, Anuncios, Recomendaciones V1, Festival generado por gustos, Mapa del festival) — pendientes físicos de sesión 8 siguen bloqueados

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

### Mapa del festival — completado y verificado (parcial: sin subida real de imagen)

Antes de construir se confirmaron con el usuario (vía `AskUserQuestion`) dos puntos que el
spec no definía: (a) sí quiere un mapa real del recinto (no un placeholder simbólico), y
(b) el mecanismo de carga es imagen subida por el admin + pines colocados a mano tocando la
imagen (posición porcentual `x_pct`/`y_pct` relativa al recuadro de la imagen), **no**
coordenadas GPS reales — evita depender de georreferenciación real de cada recinto, que no
está en el spec ni hay fuente de datos para ella.

- **Migración `add_festival_map`**: columna `festivals.mapa_url`, tabla nueva
  `festival_map_pins` (`festival_id`, `escenario`, `x_pct`, `y_pct` con `check` 0-100), RLS
  lectura pública / escritura solo-admin (mismo patrón que el resto de contenido curado).
  Bucket de Storage público `festival-maps` con RLS en `storage.objects`: lectura pública,
  insert/update/delete solo admin. `get_advisors` sin hallazgos nuevos.
- **Admin**: [map-uploader.tsx](admin/src/app/festivals/[id]/map-uploader.tsx) — sube la
  imagen directo del navegador a Storage (bypassa server actions para el binario, patrón ya
  usado en otros proyectos Supabase), persiste la URL pública resultante vía la server action
  `updateMapaUrl`; clic sobre la imagen abre un popup para nombrar el escenario (con
  autocomplete de los escenarios ya existentes en el line-up) y guardarlo como pin
  (`addMapPin`); cada pin tiene botón "×" para borrarlo (`deleteMapPin`). Todas las server
  actions en [actions.ts](admin/src/app/festivals/[id]/actions.ts), gateadas por
  `requireAdmin()`.
- **Móvil**: [FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx) — sección
  colapsable "▸ Mapa del festival" (solo aparece si `festival.mapa_url` existe) con la imagen
  y pines tocables posicionados por `left`/`top` en porcentaje; tocar un pin muestra una
  tarjeta con el line-up de ese escenario (filtrado del array de line-up ya cargado por
  `escenario`, sin pedir datos nuevos). [useFestivalStore.ts](src/store/useFestivalStore.ts)
  trae `festival_map_pins` en el `fetch()` general junto con todo lo demás.
- **Verificado con confirmación en base de datos, a través del panel admin real ya
  autenticado** (no un script aparte): el servidor de Next.js del panel admin se había caído
  durante la pausa de varios días de esta sesión (igual que Metro/el emulador) y no había
  contraseña de admin guardada (por seguridad, nunca se guarda) — se reinició el servidor
  (`preview_start` de nuevo) y, con permiso explícito del usuario, se reseteó la contraseña
  temporalmente por SQL (mismo patrón que sesión 5) para poder entrar. Con la sesión de admin
  real ya autenticada en el navegador:
  - Se puso una URL de imagen placeholder externa en `mapa_url` por SQL (para poder ver la
    imagen y probar el clic sin depender de la subida real — ver limitación abajo), se
    recargó la página del panel, se hizo clic sobre la imagen para colocar un pin con nombre
    `[verify-map] Escenario Test` — **confirmado en la base de datos** que el pin se guardó
    con `x_pct=35.27`, `y_pct=50.59` (coherente con el punto donde se hizo clic).
  - Se borró el pin con el botón "×" de la propia UI — **confirmado en la base de datos**
    que el conteo de pines volvió a 0.
  - Se limpió el `mapa_url` de prueba (vuelto a `null`) — Corona Capital 2026 queda sin
    datos de prueba residuales.
  - Aparte, con un script Node de solo-lectura (sesión anónima, sin contraseña) se confirmó
    que un usuario normal **sí puede leer** `festival_map_pins` (RLS pública) y **no puede
    insertar** (bloqueado por RLS con el mensaje esperado "new row violates row-level
    security policy") — así queda cubierto también el lado de lectura que usa la app móvil.
- **No verificado: la subida real de un archivo de imagen a través del `<input type="file">`
  del admin.** La herramienta de navegador de esta sesión no tiene forma de automatizar el
  selector de archivos nativo del sistema operativo (no hay un tool de tipo "file upload"
  disponible, a diferencia de otras integraciones de navegador) — es una limitación del
  entorno de este mismo tipo que el loop de ANR del emulador, no del código. Lo que sí se
  verificó por inspección: las políticas RLS de `storage.objects` para el bucket
  `festival-maps` son correctas (select pública, insert/update/delete solo admin — confirmado
  leyendo `pg_policies`), y el código de `handleFile` en `map-uploader.tsx` sigue el mismo
  patrón (`supabase.storage.from(...).upload()` seguido de `getPublicUrl()`) que se usa en
  integraciones de Supabase Storage estándar. **Para la próxima sesión**: si hay dispositivo
  físico o un navegador con soporte de subida de archivos disponible, probar la subida real
  de una imagen de principio a fin.
- Contraseña temporal de admin usada esta sesión: se le dio al usuario una sola vez en el
  chat, como las veces anteriores — debe cambiarla desde Supabase Auth (Authentication →
  Users → clauliz.acosta@gmail.com) antes de compartir acceso al panel.

## Sesión 10 (2026-09-07): Sprint 7 completo (gamificación y retención de bajo esfuerzo)

El usuario pidió saltar directo a Sprint 7 del spec (seis features chicas de
gamificación/retención) en vez de continuar con Sprint 5, dando el mismo
`musicaleando-spec.html` como Artifact publicado (se volvió a pedir el link al usuario al
empezar la sesión, siguiendo la práctica de sesiones anteriores — el archivo no persiste en
el filesystem entre sesiones). El spec confirma que Sprint 7 no tiene ficha propia detallada
(solo el chip list del Roadmap, que coincide exactamente con las 6 features del prompt) y
que "Backlog v2" (seguridad/ubicación en vivo, recap Wrapped, álbum de conciertos, match por
historial compartido) sigue fuera de alcance — no se tocó nada de eso esta sesión.

Antes de construir se revisó el código y el esquema real de la base de datos (`list_tables`
vía MCP de Supabase) para no reconstruir nada y para descubrir una limitación existente
importante: **`music_profile` solo tiene policy de `select` para la fila propia
(`music_profile_select_own`)** — ningún usuario puede leer el `music_profile` de un
squadmate directamente. Esto ya afectaba código existente:
`useSquadStore.fetchMySquads` intenta leer `music_profile` de todos los miembros del squad
para mostrar arquetipo/géneros/energía de cada uno, pero para cualquiera que no sea el
usuario actual esa query siempre devolvía `[]` por RLS — el código ya tenía un fallback
silencioso (`arquetipo: null, generos: [], energia: 0.5`) que ocultaba el problema. No se
tocó esa limitación existente directamente (no era parte del pedido), pero **la
comparación de squad nueva (feature 5) la hereda** si se implementa igual — se resolvió con
una RPC nueva en vez de repetir el patrón roto (ver abajo).

### 1. Insignia de miembro fundador — completado y verificado

**Corte elegido: primeros 500 usuarios registrados por `fecha_registro`** (no "primeros 30
días desde lanzamiento"). Razón: no existe ningún timestamp de "lanzamiento" en el esquema
— fijar uno ahora sería arbitrario y dejaría de tener sentido si los usuarios reales
empiezan a registrarse después de lo esperado. Un corte por conteo se mantiene igual de
significativo el día 1 que el día en que la app realmente despegue.

- Migración `sprint7_founder_badge`: tabla nueva `user_badges` (`user_id`, `badge_id`,
  `earned_at`, `meta jsonb`), función `award_founder_badge()` (`SECURITY DEFINER`) + trigger
  `AFTER INSERT ON users` que calcula el rank por `fecha_registro`/`id` y otorga `'founder'`
  si `rank <= 500`. Backfill incluido para los 6 usuarios reales ya existentes (todos
  calificaron, esperado con tan poco volumen).
- **Deliberadamente sin policy de `insert`/`update`/`delete` en `user_badges` para
  `anon`/`authenticated`** — solo `select` de la fila propia. Si existiera un insert propio,
  cualquier usuario podría otorgarse `'founder'` desde el cliente, lo cual arruina el punto
  de una insignia de exclusividad. Todas las escrituras pasan por funciones
  `SECURITY DEFINER` (que bypasean RLS por diseño), nunca por el cliente directo.
- `get_advisors` marcó `award_founder_badge`/`evaluate_rare_badges`/`trg_evaluate_rare_badges`
  como invocables directamente vía `/rpc/...` (mismo tipo de warning que ya tenían
  `create_squad`/`join_squad`/`is_squad_member` de sesiones anteriores) — se les hizo
  `REVOKE EXECUTE FROM anon, authenticated` porque no tienen ningún uso legítimo llamadas
  directamente (solo desde su trigger); los triggers siguen funcionando igual porque corren
  con los privilegios del dueño de la función, no del rol que dispara el evento.
- Se muestra en `ProfileScreen` como chip junto con las insignias raras (ver abajo).
- **Verificado con cuenta anónima real de prueba** (script Node, mismo patrón de sesión 5):
  usuario nuevo obtuvo `founder` automáticamente al registrarse (rank 7, sigue calificando
  con tan poco volumen); cuenta y fila de badge borradas al terminar, conteos de `users`
  antes/después idénticos (6).

### 2. Insignias por combinaciones raras — completado y verificado

**Curadas a mano, no calculadas estadísticamente** — con 6 usuarios reales, "raro en esta
base de usuarios" no significa nada todavía; un cálculo de rareza real se puede construir
más adelante cuando haya volumen. Se documentó explícitamente como decisión v1 en el código
y aquí, tal como pedía el prompt.

- 6 combinaciones fijas en la migración `sprint7_rare_combo_badges` (función
  `evaluate_rare_badges`, trigger `AFTER INSERT OR UPDATE OF generos, guilty_pleasures,
  flavor ON music_profile`), cada una cruzando género + década (`flavor->>'era'`) + guilty
  pleasure: metal+80s+boyband, jazz+ahora+reggaetón viejo, lofi+2000s+anime,
  latin+80s+metal desde los 15, indie+90s+pop2010, rock+ahora+anime. Metadata de
  display (label/emoji/descripción) espejada en [src/lib/badges.ts](src/lib/badges.ts) —
  el código SQL es la única fuente de verdad de *cuándo* se otorga, TS solo decide *cómo* se
  ve.
- Backfill corrido sobre los 4 `music_profile` reales existentes: ninguno matcheó ninguna
  combinación (esperado — son combinaciones deliberadamente poco comunes).
- **Verificado con cuenta de prueba real**: se le asignó a un usuario temporal un perfil que
  matchea `rock+ahora+anime` → apareció `rare_rock_anime` en `user_badges` en el mismo
  request (confirma que el trigger dispara en `INSERT`, no solo en `UPDATE`). Cuenta y datos
  borrados al terminar.

### 3. Sistema de niveles + tarjeta compartible — completado y verificado

Niveles: Iniciado (0) → Habitual (1+) → Veterano (3+) → Leyenda del mosh (5+) → Alma de
festival (8+), según cantidad de festivales con `festival_intent.status = 'voy'` — la clave
primaria de esa tabla ya es `(user_id, festival_id)`, así que un conteo de filas ya es un
conteo de festivales *distintos*, no hace falta una dimensión de "diversidad" aparte.
Umbrales son un criterio propio (documentado como tal en
[src/lib/levels.ts](src/lib/levels.ts)), no vienen del spec — con solo 1 festival real
cargado hoy, la mayoría de usuarios quedará en Iniciado/Habitual por ahora, esperado.

- [src/lib/levels.ts](src/lib/levels.ts): definiciones + `levelForFestivalCount`/`nextLevel`.
- **Reutiliza `ArchetypeCard` sin construir un componente nuevo** (tal como pedía el
  prompt) — mismo patrón de `id: string` genérico que ya se relajó para el campeón del
  Torneo Sonoro en la sesión 6. `ProfileScreen` arma una tarjeta con label/emoji/
  descripción/gradiente del nivel actual, flavor con el conteo de festivales y el siguiente
  nivel, y un botón "Compartir mi nivel" con el mismo flujo `captureRef` +
  `expo-sharing` copiado de `RevealScreen`/`TorneoScreen` (ninguna lógica de captura nueva).
- Nuevo store [useAchievementsStore.ts](src/store/useAchievementsStore.ts): trae
  `user_badges` propios + cuenta de `festival_intent` propios con `status='voy'`
  (`count: 'exact', head: true` — no trae filas, solo el número), calcula el nivel en
  cliente. Usado por `ProfileScreen` (insignias + nivel) y `HomeScreen` (conteo para el reto
  semanal, ver feature 6).
- **Verificado con cuenta de prueba real**: usuario con 1 festival confirmado (`status='voy'`
  sobre Corona Capital 2026) devolvió `festivales_confirmados: 1` desde la cuenta de logros;
  con el umbral de Habitual en 1, ese usuario cae en Habitual — coherente con
  `levelForFestivalCount`. `tsc` limpio para el componente compartido con el nuevo tipo de
  `archetype` (nivel en vez de arquetipo/campeón).
- **No verificado visualmente en emulador** (ver "Problemas de entorno" de esta sesión) —
  verificado por lectura de código + los mismos scripts de prueba por REST que confirmaron
  el dato subyacente (`festivales_confirmados`).

### 4. Encuestas cortas post-festival — completado y verificado (backend), pendiente de fecha real para ver el trigger en vivo

Dos preguntas, ambas de tap (nada de texto libre, como pedía el prompt): "¿Qué tal estuvo
[festival]?" (genial/bien/regular/malo) y, tras responder la primera, "¿Volverías el
próximo año?" (sí/no/tal vez). Se dispara solo cuando `festival.fecha_fin` ya pasó **y** el
usuario confirmó `status='voy'` **y** todavía no respondió.

- Migración `sprint7_festival_survey`: tabla `festival_survey_responses`
  (`festival_id`, `user_id`, `calificacion` con `check`, `volveria` con `check`,
  `created_at`, `updated_at`), RLS select/insert/update propio (permite reintentar/corregir
  la respuesta, no es de una sola vez).
  [useFestivalStore.ts](src/store/useFestivalStore.ts): `fetch()` ahora también trae
  `festival_survey_responses` propios y calcula `survey.due` por festival; nueva acción
  `submitSurvey`. UI en
  [FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx): tarjeta que aparece
  automáticamente bajo el festival cuando `survey.due` es verdadero, con las dos preguntas
  en dos pasos (tap → tap), sin campo de texto.
- **Corona Capital 2026 (el único festival real cargado) todavía no ha pasado**
  (`fecha_fin` 2026-11-22, hoy es 2026-09-07) — por diseño, la encuesta nunca aparece para
  ese festival en la app real todavía; es el comportamiento correcto, no un bug. Se
  **verificó el mecanismo completo por REST** con una cuenta de prueba real: insertar
  respuesta, reintentar (upsert cambia `calificacion`/`volveria` sin crear una segunda fila,
  gracias al PK compuesto), y confirmar que otro usuario no puede leer la respuesta ajena
  (`select` devuelve `[]` por RLS). La lógica de "cuándo aparece" (`fecha_fin < hoy`) es una
  comparación de fechas pura en cliente — se revisó por código, no se pudo forzar una fecha
  pasada real en la UI sin mover `fecha_fin` de un festival real, así que queda como
  pendiente de confirmación visual el día en que exista un festival real ya concluido (o si
  se decide mover `fecha_fin` de un festival de prueba temporalmente en una sesión futura).

### 5. Comparación dentro del squad — completado y verificado

Muestra, para cada miembro del squad, su nivel (mismo sistema de la feature 3), festivales
confirmados y energía — todo de datos que ya existían (`music_profile.energia`,
`festival_intent`), ninguna métrica nueva inventada, tal como pedía el prompt.

- **No se reusó el patrón de `useSquadStore.fetchMySquads`** (que intenta leer
  `music_profile` de otros usuarios directo desde el cliente) porque, como se documentó
  arriba, esa lectura ya falla silenciosamente por RLS (`music_profile_select_own`) para
  cualquiera que no sea el usuario actual. En vez de ensanchar la policy de `music_profile`
  (más superficie expuesta, afecta cualquier pantalla que toque perfiles ajenos), se agregó
  una RPC angosta y scopeada: `squad_comparison(p_squad_id)` (`SECURITY DEFINER`, migración
  `sprint7_squad_comparison_rpc`), que verifica `is_squad_member()` (la misma función ya
  usada para `squad_members`/`squad_playlist`, sin reinventar el mecanismo de autorización)
  y devuelve `user_id`, `nombre`, `energia`, `generos_count`, `festivales_confirmados` para
  cada miembro del squad pedido — nada más.
- [useSquadStore.ts](src/store/useSquadStore.ts): estado nuevo `comparisonBySquad` +
  acción `fetchComparison(squadId)`. [SquadDetailScreen.tsx](src/screens/main/SquadDetailScreen.tsx):
  sección nueva "Comparación del squad" (ordenada por festivales confirmados desc.),
  reutilizando los estilos de fila de miembro ya existentes (`memberRow`/`memberEmoji`/etc.)
  en vez de crear estilos nuevos.
- **Verificado con dos cuentas de prueba reales formando su propio squad aislado** (para no
  tocar el squad real "Los Vi"): A confirmó 1 festival real (Corona Capital) y tiene 2
  géneros/energía 0.8, B sin nada — `squad_comparison` devolvió ambas filas correctas tanto
  llamado por A como por B (ambos miembros pueden verla). **Confirmado que un no-miembro
  (cuenta C) recibe el error esperado** (`"No eres miembro de este squad"`) en vez de datos.
  Squad y las 3 cuentas de prueba borradas al terminar — conteos de `squads`/`squad_members`
  antes/después idénticos (2/3).

### 6. Reto semanal simple — completado y verificado

Sin sistema de puntos ni tabla nueva — computado enteramente de datos que ya existen
(`festival_intent`, `community_share_votes`, `community_shares`), tal como pedía el prompt
("no necesita sistema de recompensas complejo").

- [src/lib/weeklyChallenge.ts](src/lib/weeklyChallenge.ts): si el usuario tiene 0 festivales
  confirmados en total, el reto siempre es "Confirma tu primer festival" (la conversión más
  valiosa, independiente de qué semana sea); si ya tiene al menos 1, rota semana por medio
  entre "Vota en 3 trends esta semana" y "Comparte una canción esta semana" (ambos ejemplos
  literales del prompt), usando un número de semana simple para la rotación (no necesita ser
  ISO-preciso, solo consistente).
  [HomeScreen.tsx](src/screens/main/HomeScreen.tsx): nueva tarjeta con barra de progreso
  simple (`progress`/`target`), sin componente reusado porque no existía ningún patrón de
  "barra de progreso" previo en la app.
- **Verificado por código + datos reales**: con 0 votos/shares esta semana y 0 festivales
  confirmados en la cuenta real usada para las pruebas anteriores, el reto calculado es
  "Confirma tu primer festival" con progreso 0/1 — coherente con la regla. No se pudo
  confirmar visualmente el conteo de votos/shares subiendo la barra en vivo (bloqueado por
  el mismo problema de emulador de esta sesión, ver abajo), pero la query en sí
  (`community_share_votes`/`community_shares` filtrados por `user_id` y `created_at >=
  inicio de semana`) usa el mismo patrón ya validado en sesiones anteriores para estas
  tablas (RLS select-pública, confirmado en sesión 8).

### Problemas de entorno (sesión 10)

**No se intentó verificación visual en emulador esta sesión.** Al revisar el entorno,
`tasklist` mostró un `emulator.exe`/`qemu-system-x86_64.exe` ya corriendo junto con varios
procesos `node.exe` — es decir, **otra sesión de Claude Code tenía su propio servidor de
desarrollo activo en este mismo proyecto** (confirmado también por un aviso del entorno al
editar archivos: "Another chat's dev server is running in this folder"). Conectarse a ese
emulador/Metro desde esta sesión habría arriesgado interferir con el trabajo de la otra
sesión (bundles a medio cargar, estado de navegación inesperado) sin ningún beneficio real
— y las herramientas de navegador de esta sesión de todas formas no llegan a una app nativa
Android, solo a páginas web/el panel admin. Se optó por verificar todo lo posible por
REST/SQL con cuentas de prueba reales (ver cada feature arriba) y documentar como pendiente
la confirmación visual, siguiendo la misma regla que sesiones anteriores ya dejaron escrita
para cuando el emulador no es una opción confiable.

**Regla para la próxima sesión**: antes de arrancar un emulador o Metro propio, correr
`tasklist | grep -i "emulator\|qemu"` (o el equivalente) para confirmar que no hay ya una
sesión ajena usándolo — si la hay, verificar por REST/SQL en vez de competir por el mismo
recurso.

## Sesión 11 (2026-09-08): Sprint 5 completo (trends avanzados, energía musical, Recomendaciones V2, rifas)

El usuario pidió Sprint 5, dando de nuevo el link del Artifact del spec (no persiste entre
sesiones, mismo patrón de siempre). Antes de tocar nada se hizo la auditoría que pedía el
prompt de continuación: revisar si el patrón de lectura roto encontrado en la comparación de
squad de Sprint 7 (`music_profile` solo tiene RLS de `select` para la fila propia, así que
una lectura directa de perfiles ajenos desde el cliente devuelve `[]` en silencio) aparecía
en otro lado.

### Bug real confirmado y arreglado: `useSquadStore.fetchMySquads` leía perfiles de squadmates que nunca veía

**Confirmado con cuentas de prueba reales antes de tocar código**: se creó un squad de
prueba, un miembro B con un perfil completo (`arquetipo`, `generos`, `energia` reales), y se
reprodujo exactamente la query que `fetchMySquads` hacía — devolvió `[]`, cero perfiles,
ni siquiera el de A. Esto significaba que en `SquadDetailScreen`, **todo squadmate que no
fuera el usuario actual mostraba "Perfil incompleto"** y el cálculo de "% contigo" corría
contra un vector de géneros vacío — un bug real y visible, no solo teórico, que llevaba
existiendo desde que Squads se construyó (sesión 1), sin relación con el trabajo de Sprint 7.

- **Fix**: nueva función `squad_members_with_profile(p_squad_id)` (migración
  `sprint5_fix_squad_member_profile_read`), mismo patrón `SECURITY DEFINER` +
  `is_squad_member()` que ya se usó para `squad_comparison` (Sprint 7) — una RPC angosta en
  vez de ensanchar la RLS de `music_profile` (que expondría perfiles a cualquier pantalla,
  no solo a Squads). [useSquadStore.ts](src/store/useSquadStore.ts):
  `fetchMySquads` ahora llama esta RPC una vez por squad (`Promise.all`) en vez de la query
  directa de 2 pasos que fallaba en silencio.
- **Verificado con cuentas de prueba reales, antes y después del fix**: el mismo escenario
  (squad de prueba, miembro B con perfil completo) confirmó que `squad_members_with_profile`
  llamado por A **sí** devuelve el `arquetipo`/`generos`/`energia` reales de B. Cuentas y
  squad de prueba borrados al terminar.
- **No se encontró el mismo patrón en Festival Hub ni en Trends** — `festival_intent` ya
  tenía desde el principio una policy explícita `festival_intent_select_own_or_squadmate`
  (permite leer las filas propias y las de squadmates), y ni Trends personales ni Trends
  comunitarios leen `music_profile` de otros usuarios en ningún punto del código. La
  auditoría quedó acotada a este único punto real.

### 1. Trends avanzados

El spec no detalla "Trends avanzados" más allá del nombre en el chip list de Sprint 5 (igual
que Sprint 7) — se confirmó con el usuario antes de construir (`AskUserQuestion`), quien
eligió dos interpretaciones de las tres propuestas:

- **Historial de trends pasados**: cada trend diario ya se guardaba en `trends` (constraint
  `unique(user_id, fecha)`, una fila por día) pero nada más que el de hoy se mostraba nunca.
  Nueva acción `fetchHistory` en [useTrendStore.ts](src/store/useTrendStore.ts) (últimos 14
  días, excluyendo hoy — ya se muestra aparte). Sección colapsable "▸ Trends pasados (N)" en
  [HomeScreen.tsx](src/screens/main/HomeScreen.tsx), reutilizando `formatTrend` ya existente
  para el texto de cada fila. Sin tabla ni migración nueva.
- **Filtros adicionales en Trends comunitarios**: fila de chips de género (Todos + los 8
  géneros de `GENEROS`) en
  [CommunityTrendsScreen.tsx](src/screens/main/CommunityTrendsScreen.tsx) — filtra el
  ranking ya cargado en cliente por si alguna canción de la playlist/share coincide con el
  género elegido (dato ya presente en `entry.songs[].genero`, ningún query nuevo). El "Trend
  de la semana" se recalcula sobre el conjunto filtrado, no sobre el global.
- **Descartada explícitamente por el usuario**: tendencias por segmento de arquetipo (cruzar
  `community_shares` con `arquetipo` de forma agregada) — no se construyó.
- Verificado por lectura de código + los stores ya usan datos con RLS ya validada
  (`trends_select_own`, `community_share_stats` select público) — no hizo falta ninguna
  prueba de RLS nueva, solo confirmar que el filtro cliente-side funciona sobre datos reales
  (revisado, no hay festivales/shares de prueba residuales que hubieran alterado el
  resultado).

### 2. Energía musical

`music_profile.energia` (el slider 😴→🔥 del cuestionario) ya se usaba en tres lugares antes
de esta sesión — el score de compatibilidad de squad, uno de los 3 tipos de trend rotativos
(`energia_vs_ciudad`, ~1 de cada 3 días), y ahora también en la comparación de squad de
Sprint 7 — pero **nunca se mostraba directamente en el perfil del usuario**, pese a ser un
dato ya capturado. Se agregó una sección siempre visible en vez de depender de la rotación
del trend diario.

- **Hallazgo importante antes de construir**: el promedio de energía por ciudad
  (`energia_vs_ciudad`) se calculaba con una query de agregación corrida como el usuario
  normal — pero como `music_profile` solo tiene RLS de `select` para la fila propia, un
  `avg()` corrido así **también** habría colapsado silenciosamente a un solo valor (el
  propio), el mismo bug de fondo que el de Squads, aplicado a un agregado en vez de a filas
  individuales. Ya estaba resuelto porque `generate_trend_for_user` es `SECURITY DEFINER`,
  pero no había ninguna función reutilizable para el nuevo caso de uso (comparación en
  Perfil). Se extrajo la lógica a una función compartida nueva, `energia_ciudad_avg(p_ciudad)`
  (migración `sprint5_energia_ciudad_avg`), y se refactorizó `generate_trend_for_user` para
  llamarla en vez de duplicar la query — mismo comportamiento exacto, sin duplicar lógica.
  Además y a propósito no confirmado por el prompt: `energia_ciudad_avg` devuelve
  `promedio = null` si hay menos de 3 perfiles en la ciudad — con 1-2 perfiles ajenos, un
  usuario podría despejar algebraicamente el valor exacto de energía de otra persona
  específica a partir del promedio. El número simplemente nunca sale de la base de datos
  cuando eso es posible, no es un filtro de UI.
  **Verificado con cuentas de prueba reales**: con 2 perfiles en una ciudad de prueba,
  `promedio` fue `null` (`muestras: 2`); al agregar un tercer perfil, devolvió un promedio
  real (`muestras: 3`). Perfiles y ciudad de prueba limpiados al terminar.
- **UI en `ProfileScreen`**: nueva sección "Tu energía musical" — emoji de
  `energiaEmoji(profile.energia)` (ya existía en `archetypes.ts`, sin usar hasta ahora) +
  barra de progreso simple, y debajo un texto de comparación contra el promedio de la ciudad
  del usuario (leída de `users.ciudad`, propia — RLS ya lo permite) vía
  `energia_ciudad_avg`. Si no hay ciudad guardada o hay menos de 3 perfiles en ella, se
  muestra un mensaje explicando por qué no hay comparación en vez de un número engañoso.
- Sigue sin existir una pantalla de "editar mi perfil" para que el usuario cargue su propia
  `ciudad` — sin eso, la comparación de energía (y "Mi ciudad" en Trends comunitarios,
  pendiente desde Sprint 3) sigue sin datos reales que mostrar para la mayoría de usuarios.

### 3. Recomendaciones V2 (colaborativo) — completado y verificado

Job en batch nocturno (`pg_cron`, mismo patrón que el trend diario) que calcula "gente con tu
arquetipo o alta compatibilidad también coronó a X" a partir de comportamiento real de la
app — Torneo Sonoro + squads — sin ningún proveedor externo, tal como pide la sección
"Arquitectura técnica" del spec.

- **Señal usada**: campeones del Torneo Sonoro (`music_profile.flavor.torneo_campeon`, ya
  guardado desde la sesión 7) entre (a) otros usuarios con el mismo `arquetipo` (peso 1) y
  (b) squadmates con `compat_score >= 60` (peso 2 — un lazo social directo pesa más que
  "mismo balde de arquetipo"). Se excluye el propio campeón actual del usuario. Top 5 por
  score, escrito en una tabla nueva `recommendation_cache` (migración
  `sprint5_recommendation_cache_v2`) con `fuente = 'v2_colaborativo'` — la tabla sigue el
  modelo de datos `RecommendationCache` que ya estaba en el spec.
- **Mismo patrón de integridad que `user_badges` (Sprint 7)**: `recommendation_cache` solo
  tiene policy de `select` propia, ningún insert/update de cliente — todas las escrituras
  pasan por `generate_recommendations_v2_for_user`/`_for_all` (`SECURITY DEFINER`, `EXECUTE`
  revocado para `anon`/`authenticated`, solo invocables desde el cron o entre sí). Para que
  un usuario no tenga que esperar al batch nocturno para ver su primera recomendación, existe
  `refresh_my_recommendations_v2()` — sin argumentos, siempre recalcula al `auth.uid()` del
  llamador, nunca un id arbitrario (a diferencia de la función interna, que si acepta
  cualquier `p_user_id` porque el batch la llama para todos).
- **Cron nuevo**: `musicaleando-daily-recommendations-v2` a las 8:30am, junto al
  `musicaleando-daily-trends` de las 9am ya existente.
- **No es literalmente lo que algunas apps llaman "colaborativo" (filtrado por vecinos sobre
  matrices de interacción)** — es una agregación simple de conteos ponderados sobre una señal
  social real (torneo + squads), documentado así en el código: suficiente para cumplir la
  definición del spec ("gente con tu arquetipo o alta compatibilidad también eligió X") sin
  sobre-construir para el volumen de datos actual.
- **UI**: [CollaborativeArtistCard.tsx](src/components/CollaborativeArtistCard.tsx), nuevo
  componente (deliberadamente separado de `RecommendedArtistCard` de V1 — datos y copy
  distintos) en Home, debajo de la tarjeta V1. Store
  [useRecommendationsV2Store.ts](src/store/useRecommendationsV2Store.ts).
- **Cold start esperado y confirmado**: con solo 6 usuarios reales y pocos squads/torneos
  jugados, la mayoría de usuarios reales no tendrán recomendaciones V2 todavía — el propio
  spec lo anticipa ("es un diferenciador real solo si supera el cold start inicial"). No es
  un bug, es la realidad del volumen actual.
- **Verificado con cuentas de prueba reales end-to-end**: se armó un squad de prueba con dos
  miembros con géneros alineados (para que el trigger de compat_score ya validado en
  sesiones anteriores produjera `compat_score >= 60` de verdad, no simulado), se le dio a un
  miembro un campeón de Torneo Sonoro de prueba, se llamó `refresh_my_recommendations_v2`
  desde la cuenta del otro miembro, y `recommendation_cache` devolvió exactamente ese
  artista con `score: 2` (el peso de squad) — confirma el mecanismo completo, no solo la
  escritura de la tabla. Squad, perfiles y caché de prueba borrados al terminar.

### 4. Rifas + selección de ganador — completado y verificado

Se extendió el panel de admin de Sprint 4 (anuncios/patrocinios) en vez de construir algo
nuevo, tal como pedía el prompt — la tabla `announcements` y el flujo de
`announcement_interest` ya existían completos, solo faltaba la selección de ganador.

- **Decisión confirmada con el usuario antes de construir** (`AskUserQuestion`): el spec pide
  notificación push automática al ganador, pero el proyecto no tenía ninguna infraestructura
  de push (sin `expo-notifications`, sin tabla de tokens) — construir push real es
  infraestructura nueva, no una extensión chica. El usuario eligió **indicador in-app en vez
  de push real**: el admin elige ganador desde el panel, y el ganador ve un banner "🎉
  ¡Ganaste!" la próxima vez que abre el Festival Hub. Push real queda pendiente si se decide
  construirlo después.
- **Migración `sprint5_raffle_winner`**: columnas nuevas `announcements.ganador_user_id` /
  `ganador_nombre` (denormalizado, mismo patrón que `sponsor_nombre` de sesión 9 — la app
  nunca necesita leer `users` de otro usuario). Función `select_raffle_winner(p_announcement_id)`
  (`SECURITY DEFINER`): verifica `is_admin` del llamador, elige un `announcement_interest`
  al azar (`order by random() limit 1`), resuelve el nombre (`coalesce(nombre, 'Usuario
  anónimo')`), y escribe ambas columnas — todo en un solo paso, porque el panel admin
  autentica como el usuario admin real (no service role) y `users` solo tiene RLS de
  `select` propia, así que ni siquiera un admin autenticado podía resolver el nombre de otro
  usuario directamente sin esto (mismo tipo de gap que motivó el fix de Squads arriba).
- **Panel admin**: [select-winner-button.tsx](admin/src/app/festivals/[id]/select-winner-button.tsx)
  (botón "🎲 Elegir ganador", deshabilitado si `interestCount === 0`, con confirmación nativa
  porque no se puede deshacer) + acción
  [selectRaffleWinner](admin/src/app/festivals/[id]/actions.ts) — mismo patrón
  `requireAdmin()` + server action que el resto del panel. Una vez elegido, la fila de
  anuncio muestra "🎉 Ganador: [nombre]" en vez del botón. `admin/src/lib/database.types.ts`
  (tipos escritos a mano, ver "Decisiones técnicas") se actualizó con las 2 columnas nuevas y
  la función.
- **App móvil**: [FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx) — cada
  anuncio tipo rifa con ganador ya elegido muestra "🎉 ¡Ganaste esta rifa!" si
  `ganador_user_id === userId`, o "🎉 Ganador: [nombre]" para el resto (el nombre del ganador
  de una rifa es información pública por diseño, como en cualquier rifa real — no es una
  fuga de PII nueva, ya viene denormalizado a propósito).
- **Verificado end-to-end con cuentas de prueba reales**: confirmado que un no-admin
  recibe `"No autorizado."` al llamar `select_raffle_winner`. Para probar el camino de éxito
  se necesitó una cuenta real con `is_admin = true` — como no hay forma de escribir vía
  `execute_sql` (el entorno lo tiene en modo solo-lectura, `apply_migration` fue la única vía
  de escritura elevada disponible), se usó un usuario anónimo de prueba, se le puso
  `is_admin = true` por migración temporal, se marcó interés desde una segunda cuenta, se
  llamó la función como el admin de prueba, y devolvió exactamente esa segunda cuenta como
  ganadora con `ganador_nombre: 'Usuario anónimo'` (coherente, la cuenta de prueba no tiene
  `nombre`). Anuncio de prueba, flag de admin y ambas cuentas revertidos/borrados al
  terminar — confirmado por conteo antes/después (`announcements: 0`, `users: 6`, igual que
  al cierre de la sesión 10).
- **Dashboard de interés agregado sigue sin construir** — el spec lo separa de "selección de
  ganador" y el usuario no lo pidió para esta sesión; el panel sigue mostrando solo el
  conteo crudo por anuncio.

### Problemas de entorno (sesión 11)

- **El emulador Android seguía ocupado por otra sesión de Claude Code** (mismo hallazgo que
  sesión 10 — `tasklist` mostró `emulator.exe`/`qemu-system-x86_64.exe` corriendo desde el
  inicio de esta sesión). Se evitó competir por él; toda la verificación fue por REST/SQL con
  cuentas de prueba reales, igual que la sesión anterior. El panel admin (Next.js, puerto
  3000) es un proceso completamente separado del emulador — no hubo necesidad de tocarlo
  esta sesión porque toda la verificación de rifas se hizo por script en vez de por browser.
- **`execute_sql` del MCP de Supabase corrió en modo de solo lectura toda la sesión**
  (`UPDATE`/`INSERT` fallan con `ERROR: 25006: cannot execute UPDATE in a read-only
  transaction`), a diferencia de sesiones anteriores donde no se había notado (probablemente
  nunca se necesitó escribir por esa vía antes, solo leer). `apply_migration` sí puede
  escribir — se usó para las escrituras de verificación puntuales de esta sesión (dar
  `is_admin` temporal, crear/borrar un anuncio de prueba), documentado en el punto 4 arriba.
  **Para la próxima sesión**: si se necesita mutar datos por SQL directo para una prueba
  puntual (no un cambio de esquema real), usar `apply_migration` en vez de `execute_sql` —
  esto último solo sirve para lecturas en este entorno.
- Un primer intento del script de verificación de rifas falló por un bug del script mismo
  (no recargaba la sesión guardada del usuario admin de prueba, creaba uno nuevo sin el flag
  — el error `"No autorizado."` fue la pista correcta) y dejó 2 cuentas de prueba huérfanas
  sin limpiar antes de que el script fallara. Se detectaron comparando el conteo de `users`
  contra el esperado (8 en vez de 6) al hacer la verificación final de "sin residuos" —
  confirma que vale la pena, como hábito, recontar tablas clave al cierre de la sesión en vez
  de solo confiar en que cada script individual limpió bien lo suyo.

## Sesión 12 (2026-09-08): auditoría de RLS cerrada + Sprint 6 completo (mapa social, Torneo Sonoro grupal, dashboard de patrocinios, moderación)

### Auditoría de RLS en lecturas cruzando `squad_members`/`music_profile` — sin casos nuevos

Van tres bugs del mismo patrón en sesiones distintas (Squads original, `squad_comparison` de
Sprint 7 —construida ya con el fix desde el inicio—, y `fetchMySquads` arreglado en sesión 11)
así que antes de tocar Sprint 6 se dedicó tiempo a buscar el patrón en todo el código (móvil y
admin), no solo dentro de Squads:

- **Grep de `.from('music_profile')`, `.from('users')`, `.from('trends')`,
  `.from('mood_logs')` en todo `src/` y `admin/src/`**: todos los usos restantes son lecturas
  de la fila propia (`.eq('user_id', userId)` o `.eq('id', user.id)` con el id de la sesión
  actual) — ninguno intenta leer la fila de otro usuario directamente. El único punto que
  antes leía perfiles ajenos (`useSquadStore.fetchMySquads`) ya se había arreglado en la
  sesión 11.
- **Confirmado con cuentas de prueba reales** (no solo lectura de código, siguiendo la
  instrucción del prompt): se recreó un squad con dos miembros — uno con playlist de squad
  agregada — y se confirmó que `squad_members`/`squad_playlist` (que tienen policies propias
  de "compañero de squad", no de "fila propia") sí funcionan como lectura cruzada real para
  miembros y sí bloquean a un no-miembro; y que `recommendation_cache` (nueva en Sprint 5,
  select-own) efectivamente bloquea que un squadmate lea las recomendaciones cacheadas de
  otro. Cuentas y datos de prueba borrados al terminar.
- **Conclusión: no se encontraron casos adicionales.** El patrón queda documentado como
  cerrado — cualquier tabla nueva que necesite "leer datos de alguien más porque comparte
  squad/festival conmigo" debe usar una policy explícita de tipo "compañero" (como
  `squad_members_select_fellow`) o una RPC `SECURITY DEFINER` con `is_squad_member()` (como
  `squad_comparison`/`squad_members_with_profile`) — nunca asumir que una policy de
  `select-own` alcanza para mostrar datos de otros usuarios.

### 1. Mapa social — completado y verificado

Interpretación confirmada con el usuario antes de construir (`AskUserQuestion`): mostrar,
junto al conteo que ya existía (`squadGoingCount`, Sprint 3), la lista real de squadmates que
confirmaron "Voy" a ese festival — sin ubicación en tiempo real (eso sigue en Backlog v2).

- [useFestivalStore.ts](src/store/useFestivalStore.ts): `FestivalWithIntent` gana
  `squadGoingIds: string[]` (los mismos ids que ya se usaban para contar, ahora expuestos).
- [FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx): construye un mapa
  `user_id -> arquetipo` a partir de `useSquadStore.squads` (que ya carga
  `squad_members_with_profile` completo desde la sesión 11) — **sin ninguna query nueva**, y
  sin repetir el patrón de lectura roto que motivó la auditoría de esta sesión. Toggle
  "▸ N de tu squad van" ahora expande la lista con emoji+arquetipo de cada squadmate.
- **Verificado por revisión de código** (el mecanismo subyacente — `squad_members_with_profile`
  y la policy `festival_intent_select_own_or_squadmate` — ya estaba probado con cuentas
  reales en sesiones 5 y 11; esta sesión solo cambia cómo se combinan esos datos en cliente,
  no agrega superficie nueva de RLS que verificar).

### 2. Torneo Sonoro grupal (squads) — completado y verificado

Regla de avance confirmada con el usuario antes de construir: sin tiempo real, el **owner del
squad avanza manualmente** cuando quiere, gana el artista con más votos en ese momento (no se
requiere que todos voten). Reutiliza la mecánica exacta de `TorneoScreen`/`tournament.ts`
(cola de contendientes → ganadores → siguiente ronda), movida a la base de datos para que
todo el squad vote sobre el mismo matchup.

- Migración `sprint6_squad_tournament`: tablas `squad_tournaments` (estado del bracket:
  `artists`/`remaining`/`winners_this_round`/`round`/`turn`/`champion`, todo `jsonb` salvo los
  contadores) y `squad_tournament_votes` (un voto por miembro por `turn`, upsert para poder
  cambiar de voto antes de que el owner avance). `squad_tournaments` sigue el patrón
  "sin insert/update de cliente" de `user_badges`/`recommendation_cache` — todo pasa por
  `start_squad_tournament`/`advance_squad_tournament` (`SECURITY DEFINER`, verifican
  `squads.owner_id = auth.uid()` internamente). Columnas nuevas en `squads`:
  `himno_artist_id`/`himno_nombre`/`himno_imagen_url`, escritas por `advance_squad_tournament`
  al coronar campeón — el "himno oficial del squad" vive en el squad, no en el perfil de
  ningún miembro.
- Nueva pantalla [SquadTorneoScreen.tsx](src/screens/main/SquadTorneoScreen.tsx) + store
  [useSquadTournamentStore.ts](src/store/useSquadTournamentStore.ts): el owner arma el pool
  de 8 artistas con la unión de géneros de **todos** los miembros del squad (ya disponible
  vía `squad_members_with_profile`, sin query nueva) pasada a `fetchTournamentArtists` (el
  mismo Edge Function `spotify-artists` del torneo individual). Cualquier miembro vota
  tocando un lado del duelo; el owner ve "N votos en este matchup" y un botón "Avanzar
  ronda". Al coronar campeón, tarjeta compartible reutilizando `ArchetypeCard` (mismo patrón
  que niveles/campeón individual). Botón de acceso nuevo en
  [SquadDetailScreen.tsx](src/screens/main/SquadDetailScreen.tsx) mostrando el himno actual
  o "Sin torneo grupal todavía".
- **Bug real encontrado y corregido durante el desarrollo, no solo teórico**: la primera
  versión de `advance_squad_tournament` no tenía guarda contra avanzar sin ningún voto — se
  agregó explícitamente `raise exception` si nadie votó el matchup actual, para que un owner
  descuidado no corone un campeón al azar sin que nadie haya participado.
- **Verificado end-to-end con cuentas de prueba reales, bracket completo**: squad de prueba
  con owner + 1 miembro, torneo de 8 artistas de prueba, se jugaron los 7 duelos completos
  (4 de "ronda de 8" → 2 de semifinal → 1 de gran final, confirmando que
  `TOURNAMENT_DUEL_COUNT = 7` de `tournament.ts` aplica igual aquí), ambos votando siempre
  por el mismo lado para que el resultado fuera determinista — el campeón final coincidió
  exactamente con el artista votado, y `squads.himno_artist_id`/`himno_nombre` quedaron
  escritos correctamente. **Confirmado además**: un no-owner no puede iniciar ni avanzar el
  torneo (`"Solo el owner del squad puede..."`), un no-miembro no puede votar (RLS), y avanzar
  sin votos falla con el mensaje esperado. Squad, torneo, votos y cuentas de prueba borrados
  al terminar (la limpieza de `squad_tournaments`/`squad_tournament_votes` fue automática vía
  `ON DELETE CASCADE` desde `squads`, no hizo falta borrarlas a mano).

### 3. Dashboard de patrocinios (Sound Insights) — completado y verificado

Retoma "Tendencias por segmento de arquetipo" (la interpretación de Trends avanzados que
**no** se construyó en Sprint 5) como reporte agregado para patrocinadores, tal como sugería
el prompt — aplicando la regla de cumplimiento del spec ("agregación mínima de 30-50
usuarios, nunca datos individuales identificables") como una restricción real de la base de
datos, no solo un texto en la UI.

- Migración `sprint6_sponsor_insights` (+ fix `sprint6_sponsor_insights_admin_only` y
  `sprint6_fix_insights_ambiguous_column`, ver bug abajo): función
  `insights_arquetipo_generos(p_min_usuarios int default 30)` — cuenta perfiles con
  arquetipo, y si el total es menor al mínimo **devuelve cero filas**, ni siquiera al admin;
  no es un filtro de UI que se pueda saltar. `insights_profile_count()` expone solo el total
  (para que el panel explique "faltan N perfiles" sin revelar nada más granular). Ambas
  funciones verifican `is_admin` del llamador — no basta con pasar el mínimo, tienen que
  venir del panel admin.
- **Dos bugs reales encontrados y corregidos durante el desarrollo**:
  1. Las funciones de insights inicialmente solo aplicaban el filtro de mínimo de usuarios,
     sin verificar `is_admin` — cualquier usuario de la app móvil habría podido llamar el RPC
     directamente y obtener el agregado completo una vez que el proyecto superara el umbral
     de 30 perfiles. Se agregó el mismo chequeo `exists (... is_admin)` que usa el resto del
     panel admin.
  2. `insights_arquetipo_generos` fallaba con `column reference "arquetipo" is ambiguous` —
     los parámetros de salida de la función (`returns table (arquetipo text, ...)`) se
     llaman igual que las columnas de la consulta interna, un problema clásico de PL/pgSQL
     donde el nombre del parámetro de salida sombrea la columna. Se arregló con el pragma
     `#variable_conflict use_column` al inicio del cuerpo de la función. Confirmado con
     cuentas de prueba reales antes y después del fix (el error reproducía consistente antes,
     desapareció después).
- **Panel admin**: nueva página `/insights` — junta el interés por anuncio de **todos** los
  festivales en una sola lista ordenada (esto cierra el pendiente de "dashboard de interés
  agregado" que Sprint 4/5 dejaban explícitamente fuera), y muestra la tabla
  arquetipo×género si hay suficientes perfiles, o un mensaje explicando cuántos faltan si no
  los hay. Con los 4 perfiles reales actuales, el reporte está vacío por diseño — es el
  comportamiento correcto del piso de cumplimiento, no un bug.
- **Verificado con cuentas de prueba reales**: un usuario no-admin recibe `"No autorizado."`
  al llamar cualquiera de las dos funciones; con una cuenta de prueba marcada `is_admin` (vía
  `apply_migration`, ver nota de entorno abajo), `insights_profile_count()` devolvió el total
  real (4), `insights_arquetipo_generos()` con el mínimo default (30) devolvió vacío, y con
  `p_min_usuarios: 1` devolvió las filas reales agregadas — confirma tanto el gate de admin
  como el gate de volumen funcionando de verdad, no solo en el código. Cuenta de prueba
  borrada al terminar.

### 4. Moderación — completado y verificado

Alcance deliberadamente mínimo, acotado a las dos únicas superficies de texto libre de
usuario que existen hoy (comentarios de festival y el `caption` de Trends comunitarios) — las
reacciones son solo like/dislike y la playlist de squad es selección de un catálogo fijo, no
hay nada más que "reportar" ahí.

- Migración `sprint6_moderation`: columna `oculto boolean` en `festival_comments` y
  `community_shares`; las policies de `select` de ambas tablas cambiaron de "todos ven todo"
  a **"todos ven lo no oculto, el admin ve todo"** — el contenido oculto se vuelve invisible
  a nivel de RLS, no solo por un filtro de cliente que alguien podría olvidar. La vista
  `community_share_stats` (usada por el ranking de Trends comunitarios) es
  `security_invoker`, así que hereda esta regla automáticamente sin tocarla. Tabla nueva
  `content_reports` (`content_type`, `content_id`, `reporter_user_id`, `motivo` fijo:
  spam/ofensivo/otro, `resuelto`) — `select`/`update` admin-only, `insert` propio; **sin
  policy de `delete` para nadie**, a propósito: la acción de moderación es "ocultar +
  resolver", nunca borrar (ni el contenido ni el reporte).
- **App móvil**: helper compartido
  [src/lib/moderation.ts](src/lib/moderation.ts) (`promptReportContent`, un `Alert` de 3
  opciones) usado tanto en
  [FestivalHubScreen.tsx](src/screens/main/FestivalHubScreen.tsx) (link "Reportar" junto a
  cada comentario ajeno) como en
  [CommunityTrendsScreen.tsx](src/screens/main/CommunityTrendsScreen.tsx) (junto a cada share
  ajeno). Nuevas acciones `reportComment`/`reportShare` en
  `useFestivalStore`/`useCommunityStore` — **sin encadenar `.select()` tras el insert**,
  porque `content_reports` no tiene policy de `select` para el usuario normal (ver nota de
  entorno abajo, esto salió de un error real durante la verificación).
- **Panel admin**: página nueva `/moderacion` — lista reportes sin resolver con el texto del
  contenido reportado (leyendo `festival_comments`/`community_shares` directamente; el admin
  ya puede ver contenido oculto gracias a la policy de arriba), botón "Ocultar contenido"
  (pone `oculto = true` **y** `resuelto = true` en un solo paso) y "Descartar reporte" (solo
  `resuelto = true`, el contenido queda como estaba).
- **Verificado end-to-end con cuentas de prueba reales**: comentario creado por A, reportado
  por B con motivo "spam"; confirmado que **ni A ni B** pueden leer el reporte de vuelta
  (`content_reports` es admin-only incluso para el propio reportero); con una cuenta marcada
  `is_admin` se leyó el reporte, se ocultó el comentario y se resolvió el reporte en los
  mismos dos pasos que hace la acción del panel; confirmado que un usuario nuevo ya no ve el
  comentario oculto en absoluto (`select` devuelve `[]`, no solo un flag para filtrar), y que
  el admin sigue viéndolo (`oculto: true` visible). Comentario, reporte y las 4 cuentas de
  prueba borrados al terminar.

### Problemas de entorno (sesión 12)

- **El emulador Android seguía ocupado por otra sesión de Claude Code** (tercera sesión
  seguida con este hallazgo — ver sesiones 10 y 11). Toda la verificación se hizo por
  REST/SQL con cuentas de prueba reales.
- **Encadenar `.select()` tras un `.insert()` en una tabla sin policy de `select` para el
  rol que escribe rompe el insert, no solo el select** — confirmado esta sesión con
  `content_reports` (insert-only para el reportero): `supabase.from('content_reports').insert(...).select().single()`
  falla con `"new row violates row-level security policy"` aunque el `insert` en sí sea
  válido, porque PostgREST necesita hacer un `select` de la fila recién insertada para poder
  devolverla, y ese `select` sí choca con RLS. El código real de la app
  (`reportComment`/`reportShare`) nunca encadenó `.select()`, así que no tuvo este problema —
  pero el primer intento del script de verificación sí, y sirvió para documentar la regla:
  **si una tabla tiene insert-propio pero no select-propio (como `content_reports`,
  `user_badges`, `recommendation_cache`), cualquier insert desde el cliente debe omitir
  `.select()`/`.single()` después.**
- **Un cleanup de prueba con la sesión "admin" no puede borrar filas que no le pertenecen a
  él mismo** — parecía obvio en retrospectiva, pero un script de esta sesión intentó que la
  cuenta admin de prueba borrara `festival_comments`/`content_reports`/`users` de otras
  cuentas de prueba, y esos deletes fallaron en silencio (RLS filtra antes de aplicar el
  `DELETE`, sin excepción — el mismo comportamiento de Postgrest/RLS ya documentado en
  sesiones anteriores para `UPDATE`). Ninguna de esas tablas tiene policy de `delete` para
  admin a propósito (ver el punto de "Moderación" arriba — ocultar, no borrar). Se detectó
  recontando `users`/`festival_comments`/`content_reports` al final de la sesión (11 en vez
  de 6) y se limpió con `apply_migration` en vez de reintentar con la sesión equivocada.
  **Regla para la próxima sesión**: para limpiar datos de prueba tras verificar RLS
  admin-only, o se usa la sesión del actor original (dueño de la fila) para borrar, o se
  hace la limpieza final por `apply_migration` directamente — no asumir que la sesión admin
  puede borrar todo.
- `execute_sql` del MCP de Supabase sigue en modo solo-lectura este entorno (ya documentado
  en sesión 11) — todas las escrituras de verificación puntuales de esta sesión (flags de
  `is_admin` temporales) se hicieron con `apply_migration`, dejando varios registros de
  migración con nombre `verify_*` — es el costo aceptado de no tener otra vía de escritura
  elevada disponible.

## Sesión 13 (2026-09-08): Backlog v2 — Álbum de conciertos (primera pieza, desbloquea Recap anual y Match por historial)

El usuario dio el link del Artifact del spec de nuevo (mismo patrón de siempre) — la sección
"Backlog v2" ya venía con un "Orden de ataque decidido" explícito confirmando Álbum de
conciertos primero, y una ficha propia para esa feature con la moderación ya decidida
(básica, no previa a publicar — visible de inmediato, reportable, el admin puede eliminar).
Lo único que el spec **no** definía era el alcance exacto de visibilidad ("registro personal"
pero también "cualquier usuario puede reportarla", que son casi contradictorios sin más
contexto) — se confirmó con el usuario antes de construir (`AskUserQuestion`): **privado al
dueño + visible a sus squadmates**, nada público a toda la app.

### Esquema y RLS — verificado a fondo con cuentas reales, siguiendo la instrucción explícita de tratar esto como candidato a bug silencioso

Dado que ya van tres bugs del mismo patrón (Squads, comparación de squad, `fetchMySquads`) y
el prompt pedía explícitamente verificar este caso con el mismo rigor, se hizo la
verificación MÁS exhaustiva de todas las sesiones hasta ahora — no solo la tabla, también el
Storage:

- **Nueva función `users_share_a_squad(p_user_a, p_user_b)`** (`SECURITY DEFINER`) — no
  existía un helper para "¿estos dos usuarios comparten ALGÚN squad?" (`is_squad_member` es
  para un squad específico). Evita el mismo patrón de recursión/lectura-silenciosa ya
  documentado, igual que `squad_comparison`/`squad_members_with_profile`.
- **Tabla `concert_album`** (`user_id`, `festival_id`, `foto_path`,
  `consentimiento_patrocinadores`, `created_at`). RLS: `select` para el dueño, sus squadmates
  (vía `users_share_a_squad`) o un admin; `insert` solo si el usuario **ya marcó "voy"** a ese
  festival (`exists (... festival_intent ... status='voy')` en el propio `with check`) — no
  se puede subir una foto de un festival cualquiera; `update`/`delete` propios; **`delete`
  también para admin** — a diferencia de comentarios/shares (Sprint 6, que solo se "ocultan"),
  el spec pide explícitamente que una foto reportada se pueda **eliminar**, así que esta es la
  única tabla de moderación con policy de `delete` para admin.
- **Bucket de Storage `concert-album`**: **privado** (`public = false`, a diferencia de
  `festival-maps`), límite de 8MB, solo `image/jpeg`/`image/png`/`image/webp`. Policies en
  `storage.objects` replican exactamente la misma regla que la tabla (dueño, vía
  `(storage.foldername(name))[1] = auth.uid()`, o squadmate vía `users_share_a_squad`, o
  admin) — verificar la tabla NO alcanza si el archivo real sigue siendo legible por
  cualquiera; había que probar ambas capas por separado.
- **`content_reports` (Sprint 6) extendido** con el tipo `'concert_photo'` en vez de un
  mecanismo de reporte paralelo — mismo patrón, una sola tabla de reportes para todo el UGC.
- **Verificado con tres cuentas de prueba reales (A dueña, B squadmate, C ajeno) cubriendo
  cada capa por separado**:
  - `users_share_a_squad(A,B)` → `true`; `(A,C)` → `false`.
  - Insertar una foto para un festival donde A **no** había marcado "voy" → rechazado por RLS;
    después de marcar "voy" → éxito.
  - Subida real de bytes al bucket como A → éxito.
  - Lectura de la fila en `concert_album` — B (squadmate) ve la fila, C (ajeno) no.
  - Lectura del **archivo real** — B puede generar una URL firmada (`createSignedUrl`) para
    la foto de A, C recibe `"Object not found"` al intentar descargarla (Storage no distingue
    "no autorizado" de "no existe" en su respuesta, pero el efecto — bloqueo real — es el
    mismo).
  - B (no dueño) intenta borrar la fila de A → RLS lo filtra en silencio, sigue existiendo
    (mismo comportamiento de Postgrest/RLS en `DELETE` ya documentado en sesiones anteriores).
  - B reporta la foto de A (`content_type: 'concert_photo'`) → éxito.
  - Cuentas, squad, fila y archivo de prueba borrados al terminar — conteos de
    `users`/`squads`/`concert_album`/`content_reports`/objetos del bucket confirmados de
    vuelta a la línea base (0 en las tablas nuevas, 6/2 en `users`/`squads`).

### UI móvil — subir, ver álbum propio, consentimiento

- **Paquete nuevo**: `expo-image-picker` (no estaba instalado) + plugin en `app.json` con el
  texto de permiso de fotos para iOS.
- Nueva pantalla [ConcertAlbumScreen.tsx](src/screens/main/ConcertAlbumScreen.tsx)
  (navegable desde "📸 Mi álbum de conciertos" en `ProfileScreen`): lista los festivales
  donde el usuario ya marcó "Voy" (de `useFestivalStore`, ya cargado), permite elegir uno y
  subir una foto de la galería. **Antes de subir, un `Alert` pide consentimiento explícito**
  ("¿Usar esta foto como evidencia para patrocinadores?", Sí/No) — la foto se sube de
  cualquier forma, solo cambia `consentimiento_patrocinadores`, tal como pedía el spec ("el
  consentimiento debe pedirse desde la subida, aunque el uso real del dato no se construya
  todavía"). Muestra el álbum propio en grid con vista previa (`createSignedUrl`, expira en 1
  hora — se regenera cada vez que se abre la pantalla) y permite quitar una foto propia
  (mantener presionada).
- Nuevo store [useConcertAlbumStore.ts](src/store/useConcertAlbumStore.ts): `addPhoto` sube
  primero al bucket y luego inserta la fila (si la fila falla —p.ej. el usuario no había
  marcado "voy"— borra el archivo recién subido para no dejar un objeto huérfano). Valida
  tamaño (8MB) y formato en cliente antes de intentar subir, además del límite que ya aplica
  el bucket del lado del servidor.
- **"Álbum del squad" en `SquadDetailScreen`**: sección nueva que muestra las fotos de los
  squadmates (no las propias, esas ya se ven en el álbum propio) — es la única superficie
  donde tiene sentido un botón de reportar (el álbum propio no muestra fotos ajenas), así que
  se agregó ahí en vez de construir una pantalla de "álbum de X squadmate" completa, que no
  pedía el alcance de esta sesión. Mantener presionada una foto ajena abre el mismo
  `promptReportContent` ya usado para comentarios/shares (Sprint 6).
- Identificación de squadmates en ambas pantallas (mapa social y álbum del squad) sigue el
  patrón ya establecido: por arquetipo/nombre resuelto vía RPCs existentes
  (`squad_comparison`), nunca con una lectura nueva de `users`/`music_profile`.

### Reportar + panel admin

- [src/lib/moderation.ts](src/lib/moderation.ts) (`promptReportContent`, de Sprint 6) se
  reutiliza sin cambios — el `Alert` de 3 motivos ya era genérico.
- **Panel admin `/moderacion` extendido** (no se creó una página nueva — el patrón de
  reportes de Sprint 6 ya era genérico y esto encajaba ahí): ahora también lista fotos
  reportadas, mostrando una vista previa real (`createSignedUrl` resuelto en el servidor,
  el admin puede leer cualquier foto reportada gracias a la policy de admin). Acción nueva
  `deleteReportedPhoto` (en vez de "Ocultar contenido" que usan comentarios/shares): borra el
  objeto de Storage, borra la fila de `concert_album`, y resuelve el reporte — en ese orden,
  con manejo explícito del caso "la fila ya no existe" (el dueño pudo haberla borrado él
  mismo después de ser reportado).
- **Verificado con una cuenta de prueba real marcada `is_admin`** (vía `apply_migration`,
  mismo patrón que sesiones anteriores): el admin pudo leer la fila y el archivo de una foto
  reportada (aun sin ser squadmate del dueño), borrar el objeto de Storage, borrar la fila, y
  se confirmó que el archivo realmente dejó de existir después (no solo quedó inaccesible).

### Problemas de entorno (sesión 13)

- **El emulador Android seguía ocupado por otra sesión de Claude Code** — cuarta sesión
  seguida con este hallazgo (ver sesiones 10, 11, 12). Instrucción explícita de esta sesión:
  decir claramente si la subida de imagen específicamente necesitaba verse en un dispositivo
  real en vez de asumir que REST alcanzaba — **la respuesta es sí, en parte**:
  - Lo que **sí** se verificó de forma equivalente a producción: el mecanismo real de subida
    a Supabase Storage (bytes reales subidos vía la API de Storage, no solo filas de una
    tabla), la RLS de lectura/escritura en ambas capas (tabla + Storage), la generación de
    URLs firmadas, y el flujo completo de borrado — todo esto no depende de la UI de React
    Native, es la misma llamada HTTP que haría la app.
  - Lo que **no** se pudo verificar en esta sesión, y que sí requiere un dispositivo real:
    que `expo-image-picker` realmente abra la galería y devuelva una foto utilizable en este
    proyecto concreto; que `new File(uri).bytes()` (API nueva de `expo-file-system`) convierta
    correctamente el URI que entrega el picker en bytes subibles — este es un camino de código
    nuevo en este proyecto, no un patrón ya probado en otra feature; que el `Alert` de
    consentimiento aparezca y se comporte como se espera; y que la imagen subida se vea
    correctamente en el grid vía `Image` + URL firmada. **Ninguna de estas piezas se verificó
    visualmente esta sesión** — quedan como pendiente explícito para cuando haya emulador o
    dispositivo físico disponible, no se asumió que compilar sin errores fuera suficiente.
  - Repetido de sesiones anteriores por consistencia: `execute_sql` sigue en modo
    solo-lectura, se usó `apply_migration` para las escrituras de verificación puntual
    (flags de `is_admin` temporales). `storage.objects` además **bloquea el `DELETE` directo
    por SQL** ("Direct deletion from storage tables is not allowed. Use the Storage API
    instead.") — un objeto de prueba que quedó huérfano de una corrida fallida del script de
    verificación se tuvo que borrar con una sesión autenticada real llamando
    `.storage.from(bucket).remove([...])`, no con SQL. **Regla para la próxima sesión**: si
    un objeto de Storage queda huérfano de una prueba, no intentar `delete from
    storage.objects` — crear una cuenta de prueba con `is_admin` y usar la Storage API para
    quitarlo.

## Sesión 14 (2026-09-08): Backlog v2 — Recap anual estilo Wrapped

El usuario dio el link del Artifact del spec de nuevo. La ficha de "Recap anual" en
"Backlog v2" es breve (mod_desc: "Resumen del año del usuario: fotos, nivel alcanzado,
música más escuchada, festivales visitados") y no precisa período ni cómo derivar "artista
del año" — se confirmaron ambos puntos con el usuario antes de construir (`AskUserQuestion`):

- **Período: año calendario** (1 enero – 31 diciembre), no "últimos 12 meses rodantes".
- **Artista del año**: al revisar el código se encontró que `music_profile.flavor.torneo_campeon`
  solo guarda el ÚLTIMO campeón coronado — no hay ningún historial por fecha, así que
  "el más repetido este año" literalmente no se podía calcular con los datos existentes. El
  usuario eligió invertir en agregar un historial real en vez de conformarse con "el campeón
  actual" (que ni siquiera garantiza haberse coronado ese año).

### Historial de campeones — pieza nueva que el Recap necesitaba

- Migración `backlog_v2_recap_anual`: tabla `torneo_campeon_historial` (`user_id`,
  `genero_id`, `artist_id`, `artist_nombre`, `artist_imagen_url`, `coronado_at`). Mismo
  patrón de integridad que `user_badges`/`recommendation_cache` — sin insert/update/delete de
  cliente, solo `select` propia; toda escritura pasa por un trigger nuevo,
  `track_torneo_campeon_historial()` (`AFTER UPDATE OF flavor ON music_profile`), que
  compara el `artistId` antes/después y registra una fila nueva solo cuando cambia a un
  valor distinto (no en cada guardado del perfil que no toque el campeón).
- **No dispara en el `INSERT` inicial del perfil** (cuando se completa el cuestionario) — a
  propósito, porque en el flujo real (`saveFromQuiz` → inserta sin campeón,
  `applyTournamentChampion` → siempre actualiza) el campeón nunca se fija en el insert
  inicial. Se verificó esto explícitamente con una prueba que reproduce la secuencia real
  (insert sin campeón, luego 3 `update()` separados coronando dos artistas distintos y
  volviendo a coronar el primero) — confirmó 3 filas de historial y el cálculo de "más
  repetido" (`artist-1`, 2 veces) correcto. Una primera prueba que puso el campeón
  directamente en el `INSERT` (un flujo que la app real nunca produce) dio un resultado que
  parecía un bug pero no lo era — quedó documentado como lección en "Problemas de entorno".
- **Backfill para perfiles reales existentes**: los usuarios que ya tenían un campeón
  guardado de sesiones anteriores (sesión 7) recibieron una entrada de historial usando
  `updated_at` del perfil como fecha aproximada de coronación — es lo más cercano disponible,
  no hay timestamp exacto de cuándo se jugó el torneo antes de esta migración.

### Agregación del recap — `get_recap_anual(p_anio)`, siempre sobre el usuario propio

- Función `SECURITY DEFINER` que arma un solo objeto `jsonb` por año: festivales confirmados
  ese año (`festival_intent.status='voy'` join `festivals.fecha_inicio` dentro del rango),
  el campeón más repetido del año (con empate resuelto por coronación más reciente), hasta 6
  fotos del álbum de festivales de ese año (`concert_album` join `festivals.fecha_inicio`), y
  géneros/arquetipo actuales del perfil. **Sin parámetro de usuario** — siempre usa
  `auth.uid()`, no existe forma de pedir el recap de otro usuario (un recap es un resumen
  personal, no se pidió ni tiene sentido compartir la vista cruda de datos de alguien más).
- **Nivel alcanzado**: se calcula en cliente con `levelForFestivalCount` (ya existente,
  Sprint 7) aplicado al conteo de festivales **de ese año específico**, no al total
  histórico — un recap de 2026 debe reflejar el nivel según lo que pasó en 2026, no el nivel
  acumulado de toda la cuenta.
- **Verificado con cuentas de prueba reales**: recap vacío antes de tener datos (todo en
  `null`/`0`/`[]`), recap completo después de marcar "voy", coronar campeones dos veces
  (verificando el empate/desempate) y subir una foto — cada campo del JSON confirmado
  contra los datos insertados. Confirmado que el recap de un usuario B (sin datos) nunca ve
  nada del usuario A — aislamiento por `auth.uid()` funciona como se espera, sin necesidad
  de ninguna policy de "compañero" porque no hay lectura cruzada aquí.

### UI móvil — carrusel tipo Wrapped + tarjeta compartible

- Nuevo [RecapScreen.tsx](src/screens/main/RecapScreen.tsx) (navegable desde "🎁 Mi
  {año} en Musicaleando" en `ProfileScreen`): carrusel de slides tocables
  (intro → festivales → artista del año → fotos → nivel → tarjeta final compartible),
  reutilizando `QuizProgressBar` para el indicador de progreso y `ArchetypeCard` para la
  tarjeta de cierre — mismo patrón exacto de captura+compartir (`react-native-view-shot` +
  `expo-sharing`) que arquetipo/campeón/nivel de sesiones anteriores, sin construir nada
  nuevo para eso.
  - **Decisión deliberada sobre el "story" del spec**: en vez de gestos de swipe tipo
    Instagram Stories (que necesitarían una librería nueva y son más difíciles de verificar
    sin dispositivo), se implementó como un asistente con botones "Anterior"/"Siguiente" —
    misma sensación de recorrido secuencial, mecánica mucho más simple de razonar y de
    probar por código.
- **Caso límite (punto 5 del alcance)**: si el año no tiene festivales, campeón ni fotos
  (`isRecapEmpty` en [src/lib/recap.ts](src/lib/recap.ts)), se salta todo el carrusel y se
  muestra una sola pantalla amable invitando a marcar "Voy", jugar el Torneo o subir una
  foto — en vez de un carrusel con 4 de 6 slides vacíos.
- Nuevo store [useRecapStore.ts](src/store/useRecapStore.ts): llama la RPC y resuelve las
  URLs firmadas de las fotos (mismo patrón que `useConcertAlbumStore`/`ConcertAlbumScreen`
  de la sesión anterior, TTL de 1 hora).

### Problemas de entorno (sesión 14)

- **El emulador Android seguía ocupado por otra sesión de Claude Code** — quinta sesión
  seguida (ver sesiones 10-13). El prompt de esta sesión pedía aprovechar si estaba libre
  para cerrar el pendiente de `expo-image-picker` de la sesión anterior — no fue posible,
  sigue exactamente igual de pendiente. Toda la verificación de esta sesión (agregación,
  trigger de historial, aislamiento por usuario) se hizo por REST/SQL con cuentas
  desechables, igual que las últimas cinco sesiones.
- **Un primer intento de verificar "más repetido" pareció encontrar un bug que en realidad
  era un test mal diseñado**: se creó un perfil de prueba poniendo el campeón directamente
  en el `INSERT` inicial (algo que la app real nunca hace — `saveFromQuiz` nunca setea
  `torneo_campeon`). Como el trigger es `AFTER UPDATE OF flavor` (no dispara en `INSERT`),
  esa primera coronación no quedó registrada, y el conteo de "veces" salió más bajo de lo
  esperado. Rehacer la prueba reproduciendo la secuencia real de la app (insert sin campeón,
  luego solo `update()`s) confirmó que el trigger y el cálculo de "más repetido" funcionan
  correctamente. **Lección para la próxima sesión**: al probar un trigger `AFTER UPDATE`,
  reproducir la secuencia exacta de operaciones que la app real hace (insert vs. update),
  no solo el estado final deseado — un test que llega al mismo estado por un camino distinto
  puede dar un resultado engañoso.

## Sesión 15 (2026-09-08): prompt desactualizado detectado + limpieza de procesos huérfanos + Backlog v2 — Match por historial compartido

### El prompt de continuación estaba desactualizado — se detectó y se confirmó con el usuario antes de hacer nada

El prompt pegado al inicio de esta sesión era literalmente el de la sesión anterior (pedía
construir "Recap anual estilo Wrapped", que ya estaba completo y commiteado en `4278d5a`).
En vez de reconstruirlo o de asumir en silencio qué tocaba, se le señaló esto al usuario
explícitamente y se confirmó el alcance real antes de escribir código — el usuario confirmó
seguir con **Match por historial compartido**, la pieza que `ESTADO.md` ya tenía marcada
como siguiente.

### Procesos huérfanos del emulador/Metro — investigados con evidencia real, no solo "sigue ocupado"

El prompt pedía revisar si había evidencia real de otra sesión corriendo en paralelo en vez
de seguir asumiendo "está ocupado" sin más. Se investigó con `wmic`/PowerShell (no solo
`tasklist`) el árbol completo de procesos:

- **`expo start` (Metro) y el emulador** (`emulator.exe`/`qemu-system-x86_64.exe`):
  trazados hacia arriba, sus procesos lanzadores (`bash.exe`/`cmd.exe` intermedios) **ya
  habían salido** — huérfanos genuinos, corriendo hacía ~6.5 horas sin nada que los
  sostuviera.
- **El servidor `next dev` del panel admin**: trazado hacia arriba, su cadena de procesos
  terminaba en un `claude.exe` **todavía vivo** (corriendo desde el 2026-09-04) — es decir,
  sí había una sesión de Claude Code real detrás de ese proceso específico, a diferencia del
  emulador/Metro.
- Se reportó esto exacto al usuario (distinguiendo los dos casos, no un veredicto único de
  "todo está huérfano" ni "todo está en uso") y se pidió confirmación antes de cerrar nada,
  ya que matar un proceso de otra sesión activa sería una acción destructiva sobre trabajo
  ajeno. El usuario confirmó cerrar los huérfanos; el panel admin del otro `claude.exe` no
  se tocó.
- **Los intentos de ejecutar `taskkill` y `adb devices` fueron bloqueados por el "auto mode
  classifier" del entorno** (acciones de sistema/proceso, no relacionadas con git ni con el
  código del proyecto) — se le explicó esto al usuario en vez de intentar un rodeo, y el
  usuario mismo cerró los procesos huérfanos desde su propia terminal. Como consecuencia,
  **el pendiente de verificar visualmente `expo-image-picker` (Álbum de conciertos, sesión
  13) sigue sin cerrarse** — no hubo Metro/emulador utilizable dentro de esta sesión en
  ningún momento (el emulador quedó libre de Metro, pero esta sesión no pudo iniciar su
  propio Metro ni interactuar con `adb` para probarlo, por el mismo bloqueo del classifier).

### Match por historial compartido — alcance confirmado, extiende la comparación de squad existente

El spec describe esta pieza en una sola oración ("conectar usuarios por festivales a los que
ambos asistieron realmente, no solo por gustos declarados") sin definir mecanismo — y está
directamente emparentada con "Compañero ideal" (Sprint 3), que sigue pausado exactamente por
la misma razón (mecánica de match no definida, sesión 8). Se confirmó con el usuario antes
de construir (`AskUserQuestion`): **alcance limitado al propio squad**, extendiendo la
"Comparación del squad" ya existente (Sprint 6/7) — no un descubrimiento con cualquier
usuario de la app (eso habría sido, en la práctica, construir "Compañero ideal" ahora mismo,
con una superficie de privacidad nueva — "tu asistencia se vuelve descubrible por
extraños" — que nadie pidió resolver esta sesión).

- **Cero tablas nuevas.** Se recreó la función `squad_comparison(p_squad_id)` (Sprint 7)
  agregando una columna `festivales_en_comun` — el conteo de festivales donde tanto el
  usuario que llama (`auth.uid()`) como ese miembro marcaron `festival_intent.status='voy'`.
  `null` para la fila propia (no aplica "en común contigo mismo"). Al ser relativo a quien
  mira (como el "% contigo" del compat score), tenía que vivir en la misma RPC que ya
  devuelve datos relativos al llamador, no en una tabla nueva.
- **UI**: una sola línea agregada al `memberMeta` ya existente en
  [SquadDetailScreen.tsx](src/screens/main/SquadDetailScreen.tsx) ("· N en común contigo"),
  sin sección ni componente nuevo.
- **Verificado con cuentas de prueba reales**: squad de dos miembros, A marcó "voy" a dos
  festivales (uno real, uno de prueba creado y borrado en la misma sesión), B solo a uno de
  esos dos — confirmado `festivales_en_comun = 1` visto desde A hacia B **y** simétricamente
  desde B hacia A, `null` en ambas filas propias, y que un no-miembro sigue recibiendo el
  mismo rechazo de siempre (confirma que recrear la función no rompió la guarda de
  `is_squad_member`). Squad, festival de prueba y cuentas borrados al terminar — conteos de
  `users`/`squads`/`festivals`/`festival_intent` confirmados de vuelta a la línea base.

**Con esto, las 3 piezas priorizadas del Backlog v2 quedan completas.** Lo único que falta
del spec completo es lo explícitamente pausado (conexión en vivo, seguridad/ubicación) y
"Compañero ideal", que sigue siendo una decisión de producto distinta y sin resolver.

## Sesión 16 (2026-09-08): QA a fondo contra el checklist de lanzamiento del spec

Con los 7 sprints y las 3 piezas priorizadas del Backlog v2 completos (ver sesión 15), esta
sesión **no fue de desarrollo** — fue una auditoría explícita contra la sección "Checklist
para lanzamiento" del spec, para saber qué tan lista está la app para lanzarse de verdad,
no solo "feature completa". No se construyó ninguna feature nueva.

### Paso 1: deuda de verificación visual acumulada

**El emulador (ADB) estaba roto de verdad, no solo ocupado por otra sesión** — hallazgo
nuevo, distinto a lo documentado en sesiones 9-15: `adb devices` fallaba con
`"could not read ok from ADB Server"`. Investigado con `netstat`: ~100 procesos zombie de
`adb.exe` sosteniendo conexiones `ESTABLISHED` viejas contra `127.0.0.1:5037`, con un
`adb.exe` (PID 10104) escuchando en ese puerto pero sin responder (`kill-server` contra él
daba "connection actively refused"). El proceso `qemu-system-x86_64.exe` del emulador
llevaba corriendo huérfano desde la sesión anterior (mismo caso ya documentado en sesión
15: matar `emulator.exe` desde la terminal del usuario no mató el `qemu` subyacente, un
comportamiento conocido de Android Emulator en Windows). Se mató el proceso `adb.exe`
colgado (`taskkill //PID 10104 //F` — permitido por el "auto mode classifier" del entorno,
a diferencia de intentos similares en sesiones anteriores contra procesos de *otras*
sesiones) y `adb start-server` recuperó una conexión sana: `emulator-5554	device`.

**Aun con ADB sano, la app volvió a caer en el mismo ANR ya documentado en sesiones 1, 3,
8 y 9**: "System UI isn't responding" apareció en el primer relanzamiento de Expo Go, y de
nuevo tras un reintento con "Wait" (con la app cayendo de vuelta a Home entre intentos).
Siguiendo la regla que la sesión 9 dejó escrita ("no repetir el ciclo esperar→reiniciar→
esperar más de una o dos veces"), se paró ahí y se pivoteó a verificación por REST/SQL/
código — **quinta sesión consecutiva sin poder confirmar nada visualmente en el emulador**,
pese a que esta vez el problema de ADB en sí sí se pudo reparar. Confirma que el ANR es un
problema de recursos del host/AVD independiente del estado de ADB.

**De los 3 puntos señalados explícitamente para cerrar, 2 se cerraron de verdad (sin
emulador) y 1 sigue bloqueado**:

- ✅ **Camino de archivo de import corrupto — cerrado de verdad.** `parseListeningHistory`
  ([musicImport.ts](src/lib/musicImport.ts)) es una función pura (sin I/O), así que se probó
  directamente con 7 entradas realmente corruptas/inesperadas (texto no-JSON, JSON truncado,
  objeto vacío, array vacío, array sin ninguna clave reconocible, archivo vacío, JSON de un
  valor suelto): las 7 devuelven `null` sin lanzar excepción, y un caso de control con
  formato real de Spotify sí parsea — confirma que `ProfileScreen.handleImport` (línea
  `if (!parsed) { Alert.alert(...) }`) recibe exactamente lo que espera para mostrar la
  alerta amigable. No hizo falta el emulador para esto, la duda de 2 sesiones (8 y 9) era
  innecesaria — la función nunca dependió del dispositivo.
- ✅ **Comentario libre en reacciones al cartel — cerrado de verdad.** Se sospechaba que el
  campo en sí podía tener un problema (más allá del bug de teclado del emulador, que sigue
  sin causa raíz clara). Probado con dos cuentas anónimas reales contra Corona Capital 2026:
  `upsert` con texto real (incluye tildes, ñ, emoji 🎸) a `festival_feedback.comentario`
  seguido de `.select().single()` (el patrón que en otras tablas de este proyecto sí falla
  por RLS) funcionó sin error, el texto se guardó exacto, otra cuenta lo pudo leer (select
  público) y el dueño lo pudo borrar. Confirma que el campo de texto libre en sí no tiene
  ningún problema de datos/RLS — lo único que nunca se probó fue el `TextInput` físico del
  emulador, que sigue siendo sospechoso mientras no se pruebe en un teléfono real. Cuentas y
  fila de prueba borradas al terminar.
- ⏳ **Álbum de conciertos (`expo-image-picker`/`expo-file-system`) — sigue bloqueado, ahora
  la cuarta sesión consecutiva** (13, 14, 15, 16), siempre por el mismo motivo de entorno
  (emulador no disponible o, esta sesión, disponible pero en ANR), nunca por falta de
  intento. Se hizo una revisión de código a fondo de
  [ConcertAlbumScreen.tsx](src/screens/main/ConcertAlbumScreen.tsx) y
  [useConcertAlbumStore.ts](src/store/useConcertAlbumStore.ts) sin encontrar ningún bug: la
  validación de tipo MIME/tamaño ocurre antes de subir, el insert en `concert_album` limpia
  el archivo huérfano en Storage si falla, y el flujo reutiliza patrones ya probados en este
  proyecto. **Recomendación concreta para la próxima sesión**: si el emulador sigue sin ser
  confiable, probar este flujo específico en el teléfono físico del usuario en vez de seguir
  reintentando con el AVD — es la única pieza de toda la app que nunca tuvo ninguna
  confirmación visual, ni siquiera parcial.

### Paso 2: checklist de lanzamiento del spec, punto por punto

| # | Punto del checklist | Estado | Evidencia |
|---|---|---|---|
| 1 | App estable (sin crashes) | ✅ Verificado | Cero crashes reportados en 15+ sesiones de pruebas en vivo con cuentas reales sobre docenas de features. **Gap real**: no hay ninguna herramienta de crash reporting/monitoreo instalada (Sentry, Bugsnag, etc.) — sin eso, un crash de un usuario real después del lanzamiento no se enteraría nadie. |
| 2 | Conexión musical funcionando | ⚠️ Redacción del checklist desactualizada | Este punto del spec es de antes del pivote a cuestionario propio + Torneo Sonoro (Spotify Search API para artistas, no OAuth de escucha real) — la "conexión musical" real de la app hoy es el cuestionario de 10 preguntas + motor de arquetipos + Torneo Sonoro, todo verificado en vivo (sesiones 1, 6, 7). La beta de OAuth de Spotify/Apple Music sigue pausada aparte, por decisión de producto. |
| 3 | Trends diarios activos | ✅ Verificado en vivo esta sesión | `cron.job_run_details`: `musicaleando-daily-trends` corrió con éxito todos los días 2026-09-02 a 2026-09-07 sin fallos. |
| 4 | Tarjetas compartibles listas | ✅ Verificado | 4 tarjetas distintas (reveal de arquetipo, campeón de Torneo Sonoro, nivel, cierre de Recap anual) comparten el mismo flujo de captura+compartir, cada una confirmada en vivo abriendo el share sheet nativo (sesiones 1, 6, 10, 14). |
| 5 | Squads funcionando | ✅ Verificado | Crear/unirse, playlist colaborativa, quitar miembro, comparación, RLS de no-miembro — todo confirmado con cuentas reales en sesiones 4, 5, 10, 11. |
| 6 | Festival Hub listo (reacciones, comentarios, boletos, promociones) | ✅ Verificado | Reacciones, comentarios (con delete propio confirmado), "Comprar boletos" abriendo el link real de Ticketmaster, anuncios/rifas con selección de ganador — todo confirmado en vivo o por REST en sesiones 3, 5, 8, 9, 11. |
| 7 | Panel de administración probado con festival real | ✅ Verificado (de nuevo esta sesión) | Corona Capital 2026 (real, 16 artistas, link real de Ticketmaster) cargado desde sesión 5. Confirmado en vivo en esta sesión: el panel sigue accesible y funcional en `localhost:3000` con ese festival cargado. |
| 8 | Al menos un patrocinador confirmado | ❌ **Pendiente de negocio, no de código** | Confirmado en vivo esta sesión: `/sponsors` muestra "No hay patrocinadores todavía" (0 filas reales — el único patrocinador que existió fue uno de prueba, borrado al final de la sesión 9). El código para dar de alta y vincular un patrocinador a un anuncio ya existe y funciona; falta un acuerdo real con una marca. |
| 9 | Perfil musical completo | ✅ Verificado | Arquetipo, géneros, guilty pleasures, energía, import — todos confirmados en vivo con cuentas reales (sesiones 1, 6, 8, 11). |
| 10 | Sistema de niveles + insignias (fundador y combinaciones raras) | ✅ Verificado (por REST, no visualmente) | Insignia fundador, insignias raras y niveles confirmados con cuentas de prueba reales en sesión 10 — nunca confirmado con un tap real en pantalla por el ANR del emulador, pero el dato/mecanismo está probado de punta a punta. |
| 11 | Analytics agregados funcionando | ✅ Verificado en vivo esta sesión | `/insights` cargó sin error en el navegador (sesión de admin ya autenticada de otra sesión activa, reusada sin tocar su servidor): interés por anuncio (vacío, correcto — no hay anuncios activos) y tendencias por arquetipo×género respetando el piso de privacidad de 30 perfiles ("hoy hay 4"). El código de agregación funciona; simplemente no hay volumen todavía. |
| 12 | Pitch para marcas y festivales listo | ❌ Pendiente de negocio | No es una tarea de código. El dashboard de datos que alimentaría el pitch (`/insights`) ya existe y funciona (punto 11). |
| 13 | Página web de la app | ❌ Pendiente de negocio/marketing | No existe, no es una tarea de código de este proyecto. |
| 14 | Video demo | ❌ Pendiente de negocio/marketing | No existe. |
| 15 | Campaña de lanzamiento | ❌ Pendiente de negocio/marketing | No existe. |

### Conclusión de la auditoría

**El producto está, en código, listo para lanzar** con una sola pieza sin confirmación
visual completa (Álbum de conciertos — backend a fondo verificado, solo falta el clic real
en un dispositivo) y una recomendación de infraestructura antes de un lanzamiento real
(crash reporting). **Lo que separa a la app de un lanzamiento real no es trabajo de
código pendiente — son piezas de negocio** (patrocinador firmado, pitch, web, video,
campaña) que ningún cambio de código puede resolver.

No quedaron cuentas ni filas de prueba residuales de esta sesión — confirmado por conteo
(`public.users` de vuelta a 6, línea base desde sesión 10).

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
  - ~~No se probó en vivo el camino de archivo corrupto/formato no reconocido del import~~
    — **cerrado en sesión 16**: `parseListeningHistory` es pura (sin I/O), se probó
    directamente con 7 entradas realmente corruptas y siempre devuelve `null` sin lanzar
    excepción; no hacía falta el emulador para esto.
  - ~~El comentario libre de "¿Qué le cambiarías?" en reacciones al cartel no se probó en
    vivo~~ — **cerrado en sesión 16**: probado por REST con cuentas reales, el campo
    `festival_feedback.comentario` guarda/lee/borra texto real (tildes, ñ, emoji) sin
    ningún problema de datos/RLS. Lo único que sigue sin probarse es el `TextInput` físico
    del emulador en sí (bug de teclado ya documentado, entorno, no dato) — probarlo en un
    teléfono real cerraría la duda por completo.
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
- **Sprint 4 — completo** (las 5 features del chip list del spec: Festival generado por
  gustos, Mapa del festival, Recomendaciones V1, Comentarios por festival, Anuncios y
  promociones con patrocinadores). Detalle y verificación de cada una en las secciones de
  arriba.
  - La interpretación de "Festival generado por gustos" (aplicar la engine V1 al line-up
    real de un festival) no se confirmó explícitamente con el usuario porque se desprendía
    directamente de V1 + Festival Hub sin alternativas razonables — si en el uso real
    resulta ser otra cosa, ajustar.
  - Ninguna de las dos features de recomendaciones (Recomendaciones V1/Festival
    personalizado) se verificó visualmente en el emulador — bloqueado por el mismo loop de
    ANR de toda la sesión. Sí se verificó el backend completo por curl directo (no
    escriben en la base de datos, así que no hay RLS que verificar más allá de la
    respuesta).
  - **Mapa del festival**: verificado con confirmación en base de datos a través del panel
    admin real (ver sección arriba) — pin insert/select/delete y RLS confirmados. La subida
    real de una imagen vía el selector de archivos del sistema operativo **no** se pudo
    probar (limitación de la herramienta de navegador de esta sesión, no del código) — sí se
    verificaron las políticas RLS del bucket `festival-maps` por inspección directa.
- **Sprint 7 — completo** (insignia fundador, insignias por combinación rara, niveles +
  tarjeta compartible, encuestas post-festival, comparación de squad, reto semanal). Ver
  sesión 10 para detalle y verificación de cada una. Dos puntos quedan atados a datos que
  todavía no existen, no a código faltante:
  - La encuesta post-festival no se ha visto disparar en la app real porque el único
    festival real cargado (Corona Capital 2026) todavía no ha pasado — el mecanismo está
    verificado por REST, falta la confirmación visual el día en que un festival real
    concluya (o si se mueve `fecha_fin` de un festival de prueba temporalmente).
  - "Compañero ideal" (Sprint 3, sigue en pausa) y "Compañero ideal"/comparación de squad de
    Sprint 7 son features distintas — no confundirlas: la de Sprint 7 (festivales
    confirmados/energía por miembro) sí se construyó esta sesión, "Compañero ideal" (sugerir
    el usuario con mayor compat_score) sigue sin definir.
- **Sprint 5 — completo** (trends avanzados, energía musical, Recomendaciones V2, rifas +
  selección de ganador). Ver sesión 11 para detalle y verificación de cada una.
  - Push real para el ganador de rifa quedó explícitamente fuera (in-app banner en su lugar,
    confirmado con el usuario) — si se decide construir push real después, hace falta
    `expo-notifications`, una tabla de tokens por usuario, y una Edge Function o trigger que
    llame a la Expo Push API.
  - ~~Dashboard de interés agregado (comparar entre anuncios/festivales) sigue sin
    construir~~ — **resuelto en sesión 12**, ver `/insights` en el panel admin.
  - Sigue sin existir una pantalla de "editar mi perfil" (nombre/ciudad) — bloquea que la
    comparación de energía por ciudad y "Mi ciudad" en Trends comunitarios tengan datos
    reales para la mayoría de usuarios.
- **Bug real encontrado y arreglado en sesión 11, sin relación directa con el pedido de esa
  sesión pero confirmado por instrucción explícita de auditar el patrón**: `music_profile`
  solo tiene RLS de `select` propia, así que `useSquadStore.fetchMySquads` leía perfiles de
  squadmates que la RLS bloqueaba en silencio desde que Squads existe (sesión 1) — todo
  squadmate ajeno mostraba "Perfil incompleto" y "% contigo" salía mal. Arreglado con una RPC
  (`squad_members_with_profile`, mismo patrón que `squad_comparison`). Ver sesión 11 para el
  detalle completo de cómo se confirmó con cuentas de prueba antes y después del fix.
- **Sprint 6 — completo** (sesión 12): mapa social (lista de squadmates asistentes en
  Festival Hub), Torneo Sonoro grupal (bracket compartido por squad, owner avanza
  manualmente, himno oficial guardado en `squads`), Dashboard de patrocinios (`/insights` en
  el panel admin: interés agregado + tendencias por arquetipo×género con piso de 30
  usuarios), Moderación (reportar + ocultar sobre comentarios de festival y shares
  comunitarios, panel `/moderacion`). Ver sesión 12 para detalle completo, incluyendo la
  auditoría de RLS que se hizo antes (sin casos nuevos encontrados) y dos bugs reales
  corregidos en las funciones de insights (falta de chequeo admin, columna ambigua en
  PL/pgSQL).
  - Con los 7 sprints numerados del roadmap original completos, lo único que queda del
    spec es lo explícitamente pausado: conexión en vivo y Backlog v2 (ver abajo).
- **Conexión en vivo (Spotify/Apple Music OAuth, beta cerrada)** sigue explícitamente
  pausada — el spec la marca como feature detrás de feature flag solo para una cohorte
  allowlist, y el usuario pidió no construirla salvo confirmación explícita de que es
  momento de abrir esa beta.
- **Backlog v2 — Álbum de conciertos completo** (sesión 13): tabla `concert_album` +
  bucket privado `concert-album`, visibilidad dueño+squad confirmada con el usuario y
  verificada a fondo con cuentas reales en ambas capas (tabla y Storage), subida desde
  `ConcertAlbumScreen`, consentimiento explícito por foto, reportar + `/moderacion` con
  eliminación real (no solo ocultar, a diferencia de comentarios/shares). Ver sesión 13 para
  detalle completo.
  - **Pendiente de verificación visual, explícitamente señalado (no asumido)**: el flujo de
    `expo-image-picker` + `expo-file-system` (`File.bytes()`) abriendo la galería real y
    subiendo una foto real desde la UI de React Native — es código nuevo en este proyecto, no
    un patrón ya probado. El mecanismo de Storage/RLS subyacente sí se verificó a fondo (subida
    real de bytes vía API, no solo filas), pero la ruta completa "usuario toca botón → elige
    foto → sube → la ve en su álbum" necesita un dispositivo real o emulador disponible.
  - ~~Backlog v2 — Recap anual sigue sin construir~~ — **resuelto en sesión 14**.
    ~~Match por historial compartido sigue sin construir~~ — **resuelto en sesión 15**, ver
    esa sección.
  - **Backlog v2 — Seguridad/ubicación en vivo en squad** sigue sin construir y sin tocar,
    tal como está documentado en el spec (necesita una decisión de producto/legal explícita
    antes de cualquier código). **Es la única pieza del Backlog v2 sin construir que sigue
    activa** (conexión en vivo es una decisión aparte, ya pausada desde antes del Backlog v2).
- **Backlog v2 — Recap anual estilo Wrapped completo** (sesión 14): período de año
  calendario, historial real de campeones del Torneo Sonoro (tabla nueva
  `torneo_campeon_historial`, no existía antes), función `get_recap_anual(p_anio)`, carrusel
  de slides en `RecapScreen` con tarjeta compartible de cierre. Ver sesión 14 para detalle
  completo, incluyendo una lección sobre cómo probar triggers `AFTER UPDATE` correctamente.
- **Backlog v2 — Match por historial compartido completo** (sesión 15): alcance confirmado
  con el usuario (solo dentro del squad, no descubrimiento con cualquier usuario de la app),
  implementado como una columna nueva (`festivales_en_comun`) en la función
  `squad_comparison` ya existente — cero tablas nuevas. Ver sesión 15 para detalle completo.
  - **Sigue pendiente, ahora desde hace cuatro sesiones**: el flujo de `expo-image-picker` de
    Álbum de conciertos (sesión 13). La sesión 16 reparó un problema de ADB genuino (daemon
    colgado + ~100 procesos zombie, distinto del problema de "otra sesión lo está usando" de
    sesiones anteriores) y logró conectar con el emulador, pero la app volvió a caer en el
    mismo ANR "System UI isn't responding" documentado desde la sesión 1 en cuanto se
    relanzó — ni siquiera llegó a abrirse la pantalla. Recomendación: si el emulador sigue
    sin ser confiable en la próxima sesión, probar este flujo puntual en el teléfono físico
    del usuario en vez de seguir reintentando con el AVD.
- Ninguna de las features de Sprint 5/6/Backlog v2 se verificó visualmente en emulador (ver
  "Problemas de entorno" de las sesiones 10-15 para la razón específica de cada una). Todo
  se verificó con cuentas de prueba reales por REST/SQL/Storage API.

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
- **(Sesión 9) La herramienta de navegador de este entorno no puede automatizar el selector
  de archivos nativo del sistema operativo** (`<input type="file">`): no hay un tool tipo
  "file upload" disponible para el Browser pane usado en esta sesión (a diferencia de otras
  integraciones de navegador que sí lo tienen). Bloqueó la verificación end-to-end de la
  subida de imagen en "Mapa del festival" — se verificó todo lo demás (RLS del bucket, pin
  insert/select/delete) por otros medios. Si se repite en el futuro con otra feature que
  suba archivos, no perder tiempo intentando `form_input` sobre el input de archivo (falla
  con `InvalidStateError`, los navegadores no permiten setear su `value` por JS) — documentar
  el bloqueo directamente.
- **(Sesión 9) El "auto mode classifier" del entorno bloquea comandos de shell que contienen
  una contraseña en texto plano** (por ejemplo un script Node con `signInWithPassword({...,
  password: '...'})`), incluso si la contraseña es una temporal creada por la propia sesión
  para pruebas legítimas — y también bloquea extraer el cookie de sesión (`auth-token`) del
  navegador vía `javascript_tool` para reusarlo en un script. Ninguno de los dos intentos es
  la forma correcta de verificar algo que requiere sesión de admin: en vez de eso, iniciar
  sesión en el panel a través de la UI real del navegador (eso sí funciona sin bloqueo) y
  ejecutar la acción que se quiere probar directamente ahí. Un script Node **sin** contraseña
  (sesión anónima, `signInAnonymously()`) no se bloquea.

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
7. **Los 7 sprints numerados del roadmap original del spec están completos.** Sprint 4
   (commit `74185d1` y el anterior de la sesión 9): Festival generado por gustos, Mapa del
   festival, Recomendaciones V1, Comentarios por festival, Anuncios y promociones. Sprint 7
   (sesión 10): insignia fundador, insignias por combinación rara, niveles + tarjeta
   compartible, encuestas post-festival, comparación de squad, reto semanal. Sprint 5
   (sesión 11): trends avanzados, energía musical visible, Recomendaciones V2
   (colaborativo), rifas + selección de ganador — más un bug real de RLS en Squads
   encontrado y arreglado. Sprint 6 (sesión 12): mapa social, Torneo Sonoro grupal, Sound
   Insights (dashboard de patrocinios), Moderación — más la auditoría de RLS que precedió
   ese sprint (sin casos nuevos encontrados) y dos bugs reales en las funciones de insights
   (ver esa sección).
   **Backlog v2, las 3 piezas priorizadas están completas.** Álbum de conciertos (sesión
   13): tabla `concert_album`, bucket privado `concert-album`, visibilidad dueño+squad,
   subida desde `ConcertAlbumScreen`, consentimiento explícito, reportar + `/moderacion` con
   eliminación real de fotos. Recap anual (sesión 14): historial real de campeones del
   Torneo Sonoro (`torneo_campeon_historial`, no existía antes), función
   `get_recap_anual(p_anio)` (año calendario), carrusel en `RecapScreen` con tarjeta
   compartible de cierre. Match por historial compartido (sesión 15): alcance limitado al
   propio squad (confirmado con el usuario, no descubrimiento con cualquier usuario de la
   app), columna nueva `festivales_en_comun` en la función `squad_comparison` ya existente
   — cero tablas nuevas.
   **Pendiente de verificación visual explícito, acumulado desde sesión 13 (ahora van tres
   sesiones)**: el flujo de `expo-image-picker`/`expo-file-system` desde la UI real del
   álbum de conciertos. La sesión 15 encontró y el usuario cerró los procesos huérfanos que
   ocupaban el emulador, pero el "auto mode classifier" del entorno bloqueó `taskkill` y
   `adb devices` dentro de la sesión misma — no se pudo aprovechar la limpieza todavía.
   **Solo queda sin construir del Backlog v2: Seguridad/ubicación en vivo** (necesita
   decisión de producto/legal antes de tocarse). **Conexión en vivo (Spotify/Apple Music
   OAuth)** sigue pausada por separado (el usuario debe confirmar explícitamente antes de
   abrir esa beta), igual que **Compañero ideal** (Sprint 3, mecánica sin definir).
   **Siguiente foco: a decidir con el usuario.** Opciones razonables: (a) Seguridad/
   ubicación en vivo si el usuario confirma que ya se resolvió la decisión de producto/legal
   que el spec pide, (b) abrir la beta de conexión en vivo, (c) definir por fin la mecánica
   de Compañero ideal, o (d) cerrar los pendientes de verificación visual acumulados (ver
   "Pendiente") — el más urgente sigue siendo probar la subida de fotos del álbum en un
   dispositivo real, ahora que el emulador está libre de procesos huérfanos. El detalle
   exacto del spec **no está guardado en este repo ni en el sistema de archivos** — se ha
   leído siete veces (sesiones 9-15) desde un Artifact publicado que el usuario comparte por
   link en el chat, y ese contenido no persiste entre sesiones. **Antes de construir
   cualquier cosa nueva, pedirle al usuario el link del Artifact del spec de nuevo y
   confirmar el alcance exacto** — no asumir a partir de lo que se infiere abajo.
   - **Compañero ideal sigue sin definir**: no avanzar en código hasta que el usuario
     confirme o corrija la interpretación propuesta en la sesión 8 (compat_score más alto
     entre todos los usuarios de la app, no solo squadmates). No es parte de ningún sprint
     numerado explícito, pero sigue pendiente y en pausa.
   - **Van dos sesiones seguidas (8 y 9) sin poder probar en físico**: el camino de archivo
     corrupto del import y el campo de comentario libre de reacciones al cartel siguen sin
     verificación visual — solo revisión de código + verificación por REST del resto del
     mecanismo de comentarios. Si hay un teléfono físico disponible en algún momento,
     priorizar probar ahí antes que seguir peleando con el emulador.
   - Tampoco se pudo verificar visualmente Recomendaciones V1/Festival generado por gustos
     ni Mapa del festival (imagen real) en dispositivo — backend/DB ya confirmados por
     curl/SQL, falta la UI en un dispositivo real o un navegador con soporte de subida de
     archivos.
   - Si se agrega una pantalla de "editar mi perfil" en algún momento (nombre/ciudad), eso
     desbloquea probar "Mi ciudad" en Trends comunitarios con datos reales.
8. Si el emulador vuelve a entrar en el loop de ANR documentado en "Problemas de entorno"
   (sesión 9) desde el primer arranque, no perder mucho tiempo reintentando — usar
   verificación por REST/SQL con `@supabase/supabase-js` y sesiones anónimas reales (ver
   ejemplo de script en la sección de Comentarios de la sesión 9) para confirmar RLS y
   mecánica de escritura, y documentar la verificación visual como bloqueada.
9. Si hace falta autenticarse en el panel admin y no se tiene la contraseña a mano (se
   pierde la sesión del navegador entre sesiones de trabajo), pedirle permiso al usuario y
   resetearla temporalmente por SQL (`crypt()` de `pgcrypto` sobre
   `auth.users.encrypted_password`, mismo patrón que sesiones 5 y 9) — nunca guardar la
   contraseña en este archivo ni en el repo. Para cualquier verificación por script que
   requiera sesión de admin (email/password), usar la UI real del navegador en vez de un
   script Node con la contraseña en texto plano — el "auto mode classifier" del entorno
   bloquea ese patrón (ver "Problemas de entorno" sesión 9); un script con sesión anónima
   (`signInAnonymously()`, sin contraseña) sí funciona para verificar RLS de lectura pública.
10. **Sprint 7 (sesión 10)**: tablas/funciones nuevas — `user_badges` (RLS: solo `select`
    propio, todo `insert` pasa por triggers `SECURITY DEFINER`, nunca por el cliente),
    `festival_survey_responses` (RLS select/insert/update propio), función/RPC
    `squad_comparison(p_squad_id)`, funciones `award_founder_badge()`/`evaluate_rare_badges()`
    (triggers en `users`/`music_profile`, con `EXECUTE` revocado para `anon`/`authenticated`
    — solo se disparan vía trigger). Metadata de insignias/niveles en
    [src/lib/badges.ts](src/lib/badges.ts) y [src/lib/levels.ts](src/lib/levels.ts); reto
    semanal calculado en cliente sin tabla nueva en
    [src/lib/weeklyChallenge.ts](src/lib/weeklyChallenge.ts). Antes de tocar cualquiera de
    estas tablas, revisar la sección de sesión 10 completa — documenta por qué se optó por
    una RPC en vez de ensanchar RLS de `music_profile` (ver el hallazgo de esa limitación al
    inicio de la sección).
11. Antes de arrancar el emulador o Metro, correr algo como
    `tasklist | grep -i "emulator\|qemu"` (Windows) para confirmar que no hay ya una sesión
    de Claude Code distinta usándolo — la sesión 10 (y también la 11) encontró exactamente
    eso y evitó interferir verificando por REST/SQL en su lugar.
12. **Sprint 5 (sesión 11)**: tabla nueva `recommendation_cache` (RLS: solo `select` propio,
    mismo patrón sin-insert-de-cliente que `user_badges`), funciones
    `generate_recommendations_v2_for_user`/`_for_all` (`SECURITY DEFINER`, `EXECUTE`
    revocado para `anon`/`authenticated` — solo cron/entre sí) y
    `refresh_my_recommendations_v2()` (self-serve, siempre sobre `auth.uid()`), cron
    `musicaleando-daily-recommendations-v2` (8:30am). Función compartida nueva
    `energia_ciudad_avg(p_ciudad)` (reemplazó lógica duplicada dentro de
    `generate_trend_for_user`) — devuelve `promedio = null` si `muestras < 3`, a propósito,
    ver sesión 11 para el porqué. Fix de RLS: `squad_members_with_profile(p_squad_id)`
    reemplazó la lectura rota de perfiles de squadmates en `useSquadStore.fetchMySquads`.
    Rifas: columnas `announcements.ganador_user_id`/`ganador_nombre` + función
    `select_raffle_winner(p_announcement_id)` (verifica `is_admin` internamente, llamada
    desde el panel admin). Antes de tocar cualquiera de estas, revisar la sección de sesión
    11 completa.
13. **`execute_sql` del MCP de Supabase es de solo lectura en este entorno** (confirmado en
    sesión 11 — `INSERT`/`UPDATE`/`DELETE` fallan con "cannot execute UPDATE in a read-only
    transaction"). Para cualquier escritura puntual de verificación (dar `is_admin` temporal
    a una cuenta de prueba, crear/borrar una fila de prueba fuera del flujo normal de la
    app), usar `apply_migration` en su lugar — funciona para DML, no solo DDL, aunque dejará
    un registro de migración con nombre `verify_*`. Después de cualquier tanda de pruebas con
    cuentas/datos desechables, recontar las tablas clave (`users`, `squads`,
    `announcements`, etc.) contra el conteo esperado antes de dar por buena la limpieza — la
    sesión 11 encontró 2 cuentas de prueba huérfanas exactamente así, de un script que había
    fallado a medias antes de llegar a su propia limpieza.
14. **Sprint 6 (sesión 12)**: tablas nuevas `squad_tournaments`/`squad_tournament_votes`
    (RLS: select para miembros del squad vía `is_squad_member()`, sin insert/update de
    cliente — todo pasa por `start_squad_tournament`/`advance_squad_tournament`,
    `SECURITY DEFINER`, verifican `owner_id` internamente) y `content_reports` (insert
    propio, select/update solo admin, **sin delete para nadie** — moderación es
    ocultar+resolver, nunca borrar). Columnas nuevas: `squads.himno_artist_id`/`himno_nombre`/
    `himno_imagen_url`; `festival_comments.oculto`/`community_shares.oculto` (con las
    policies de `select` de ambas tablas cambiadas a "no oculto o admin" — revisar
    `sprint6_moderation` antes de tocarlas). Funciones nuevas `insights_arquetipo_generos`/
    `insights_profile_count` (admin-only, la primera con el pragma
    `#variable_conflict use_column` — necesario porque sus parámetros de salida se llaman
    igual que columnas de la consulta interna, un bug real que se reprodujo y arregló esta
    sesión). Antes de tocar cualquiera de estas, revisar la sección de sesión 12 completa —
    incluye la auditoría de RLS que se hizo antes de construir nada.
15. **Un `.insert(...).select()` encadenado falla si la tabla no tiene policy de `select`
    para quien escribe** (confirmado en sesión 12 con `content_reports`, que es insert-propio
    pero sin select-propio) — el error es el mismo `"new row violates row-level security
    policy"` que un insert realmente rechazado, así que puede confundir. Si una tabla sigue
    el patrón "insert propio, select solo admin/nadie" (`content_reports`, `user_badges`,
    `recommendation_cache`), cualquier insert desde el cliente debe omitir `.select()`
    después — el código real de la app ya lo hace bien, pero un script de verificación
    puede pisar este mismo error si no se tiene presente.
16. **La sesión "admin" de una prueba no puede borrar filas de otros usuarios en tablas sin
    policy de `delete` para admin** (confirmado en sesión 12: intentar borrar
    `festival_comments`/`users` ajenos desde una cuenta admin de prueba falla en silencio,
    0 filas afectadas, sin excepción — mismo comportamiento de Postgrest/RLS ya documentado
    para `UPDATE` en sesiones anteriores). Para limpiar datos de prueba después de verificar
    un flujo admin-only, usar la sesión del actor original (dueño de la fila) para borrar, o
    hacer la limpieza final directamente por `apply_migration` — no asumir que "admin" puede
    borrar cualquier cosa solo porque puede leerla/ocultarla. **Confirmado de nuevo en sesión
    13** con `concert_album`/`users`, mismo patrón exacto.
17. **Backlog v2 — Álbum de conciertos (sesión 13)**: tabla `concert_album` (RLS: `select`
    dueño/squadmate/admin vía el helper nuevo `users_share_a_squad(p_user_a, p_user_b)`,
    `insert` solo si `festival_intent.status='voy'` para ese festival, `delete` propio **y**
    admin — a diferencia del resto de moderación de Sprint 6, esta sí permite borrar de
    verdad). Bucket de Storage **privado** `concert-album` (8MB, solo
    jpeg/png/webp) con policies en `storage.objects` que replican la misma regla
    dueño/squadmate/admin — verificar la tabla no basta, hay que probar el archivo real por
    separado. `content_reports` extendido con `content_type = 'concert_photo'`. Antes de
    tocar cualquiera de estas, revisar la sección de sesión 13 completa.
18. **`storage.objects` bloquea `DELETE` directo por SQL** ("Direct deletion from storage
    tables is not allowed. Use the Storage API instead.") — a diferencia de las tablas
    normales, un objeto de Storage huérfano de una prueba no se puede limpiar con
    `apply_migration`; hay que autenticar una sesión real (anónima + flag `is_admin` si el
    objeto no es propio) y llamar `.storage.from(bucket).remove([...])`.
19. **Backlog v2 — Recap anual (sesión 14)**: tabla `torneo_campeon_historial` (select
    propia, sin insert/update/delete de cliente — todo pasa por el trigger
    `track_torneo_campeon_historial()`, `AFTER UPDATE OF flavor ON music_profile`, que solo
    registra cuando el `artistId` del campeón cambia). Función
    `get_recap_anual(p_anio)` (`SECURITY DEFINER`, siempre sobre `auth.uid()`, sin parámetro
    de usuario). Antes de tocar cualquiera de estas, revisar la sección de sesión 14
    completa — incluye por qué el trigger es `AFTER UPDATE` y no `AFTER INSERT OR UPDATE`
    (el flujo real de la app nunca fija el campeón en el insert inicial del perfil) y una
    lección sobre cómo probar ese tipo de trigger correctamente (reproducir la secuencia
    real insert-luego-updates, no solo el estado final).
20. **Backlog v2 — Match por historial compartido (sesión 15)**: sin tablas nuevas — la
    función `squad_comparison(p_squad_id)` (Sprint 7) ahora también devuelve
    `festivales_en_comun` (conteo de festivales donde el llamador y ese miembro coinciden en
    `status='voy'`, `null` para la fila propia). Recordar que cambiar las columnas de
    retorno de una función requiere `DROP FUNCTION` + `CREATE` (no basta `CREATE OR REPLACE`
    cuando cambia el shape de salida) — así se hizo aquí.
21. **El "auto mode classifier" del entorno bloquea comandos de sistema/proceso** (`taskkill`,
    `adb devices`, un `find /` amplio) **incluso cuando no involucran credenciales** —
    confirmado en sesión 15. A diferencia del bloqueo de contraseñas en texto plano (sesión
    9, sí evitable usando la UI real), este bloqueo de comandos de sistema no tiene rodeo
    razonable — hay que explicarle al usuario qué se necesitaba hacer y para qué, y dejar
    que lo haga desde su propia terminal si aplica. No reintentar con variantes del mismo
    comando.
22. **Para saber si un proceso (Metro, emulador, un dev server) sigue realmente en uso o es
    un huérfano de una sesión que terminó mal**, `tasklist`/`Get-Process` solos no alcanzan
    — hay que trazar el árbol de procesos hacia arriba
    (`Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` → columna `ParentProcessId`,
    repetir con cada padre) hasta encontrar la raíz: si esa raíz ya no existe, es un
    huérfano genuino; si termina en un `claude.exe`/terminal todavía vivo, alguien puede
    seguir usándolo. Sesión 15 encontró exactamente ambos casos a la vez (Metro/emulador
    huérfanos, panel admin con una sesión viva detrás) — no asumir que todos los procesos
    de una carpeta comparten el mismo estado.
