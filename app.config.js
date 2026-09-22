// Config dinámica en vez de app.json estático — el único motivo es poder
// resolver android.googleServicesFile en tiempo de build. google-services.json
// vive en la raíz del proyecto para desarrollo local, pero está en
// .gitignore (es una credencial de Firebase) — y EAS Build solo sube al
// builder los archivos que git tiene rastreados, así que un build en la
// nube nunca lo vería si esto siguiera siendo un app.json plano (ver
// EAS_BUILD_MISSING_GOOGLE_SERVICES_JSON_ERROR, que fue justo el error real
// que tiró el primer intento de build de este ticket).
//
// La solución documentada de Expo: subir el archivo como variable de
// entorno de EAS de tipo "file" (ver `eas env:set --type file`, ya hecho
// para production/preview/development) y, si existe, EAS la materializa
// en disco durante el build y pone su ruta real en process.env.GOOGLE_SERVICES_JSON.
// Localmente (expo start, o un build fuera de EAS) esa variable no existe,
// así que cae de vuelta al archivo local de siempre.
//
// El resto de la config (nombre, splash, plugins, etc.) sigue siendo el
// mismo JSON de antes — no se reescribió a mano para minimizar el riesgo
// de una diferencia accidental.
const base = require('./app.config.base.json');

module.exports = () => ({
  ...base,
  expo: {
    ...base.expo,
    android: {
      ...base.expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? base.expo.android.googleServicesFile,
    },
  },
});
