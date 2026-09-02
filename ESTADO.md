# Estado del proyecto — Musicaleando

Última actualización: 2026-09-02. Este archivo es el punto de partida para
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
  (ficticios, `link_boletos` apunta a `example.com` — placeholders). Verificado en
  dispositivo: lista de festivales, botones Voy/Tal vez/No voy, botón Comprar boletos.
  **Detalle sin confirmar**: al tocar "Voy" no se vio el cambio visual de selección en la
  única prueba que hice — puede ser timing de la captura de pantalla o un bug real de estado
  optimista en `useFestivalStore.setStatus`. Revisar al retomar.

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

## Pendiente del Sprint 2

- **Panel de administración web** (proyecto separado, Next.js o SPA ligera) — no se empezó.
  Necesita: form para alta de festival, importación de line-up vía CSV, protegido por rol
  admin (columna `users.is_admin` ya existe en el schema, RLS de escritura en
  `festivals`/`festival_lineup` ya está lista y probada — falta solo la UI web).
- **Botón "Comprar boletos"**: implementado y funcional (`Linking.openURL`), pero los 3
  festivales sembrados tienen links de ejemplo (`example.com`) porque no hay panel admin
  para cargar links reales todavía.
- Confirmar visualmente el flujo completo de crear/unirse a un squad (bloqueado por el bug
  de teclado del emulador, no por el código — ver abajo).
- Confirmar que el botón "Voy"/"Tal vez"/"No voy" en Festival Hub cambia visualmente al
  estado seleccionado.
- El invite code de squad se puede compartir hoy solo como texto plano vía `Alert` (no abre
  share sheet nativo) — ver "Decisiones técnicas" para el porqué; podría mejorarse a un
  share sheet real de solo-texto en vez de un Alert.

## Decisiones técnicas tomadas en el camino (no estaban en el prompt original)

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

1. `npx expo start` desde la raíz del proyecto (usa el `.env` ya configurado).
2. Emulador: `Pixel_8` AVD ya existe (`emulator -avd Pixel_8`), o usar el teléfono físico
   con Expo Go (mismo QR/URL de siempre mientras Metro corra en la misma red).
3. Revisar primero si el flujo de crear/unirse a squad funciona en un entorno con teclado
   sano (el código no cambió desde que se probó parcialmente).
4. Siguiente bloque de trabajo sugerido: panel de administración web (nuevo proyecto,
   probablemente en una carpeta hermana o subcarpeta `admin/`, mismo Supabase).
