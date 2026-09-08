import * as Sentry from '@sentry/react-native';

// Debe llamarse una sola vez, antes de importar App — ver index.ts.
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // Permite correr en local sin DSN configurado (no debe romper el arranque).
    console.warn('EXPO_PUBLIC_SENTRY_DSN no está configurado — Sentry deshabilitado.');
    return;
  }

  Sentry.init({
    dsn,
    // Detección de ANR en Android (hilo principal bloqueado, el mismo síntoma
    // exacto de "System UI isn't responding" que se está rastreando desde
    // ESTADO.md sesión 16) es nativa y viene activada por default en el SDK
    // Android que @sentry/react-native empaqueta — umbral de 5s
    // (`io.sentry.anr.enable`/`io.sentry.anr.timeout-interval-millis`, no
    // existe un flag JS equivalente en esta versión del SDK). `enableNative`/
    // `enableNativeCrashHandling` también quedan en su default `true`.
    // `enableAppHangTracking` (equivalente de iOS, no aplica en Android) se
    // deja igual en su default `true` por si el proyecto agrega iOS después.
    tracesSampleRate: 1.0,
    debug: __DEV__,
  });
}
