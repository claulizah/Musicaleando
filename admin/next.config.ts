import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

// Sin SENTRY_AUTH_TOKEN configurado (no versionado, ver .env.local), la subida de
// source maps se salta con un warning en vez de fallar el build — el reporte de
// errores en sí no depende de eso. Agregar el token en .env.local si se quiere
// stack traces legibles en producción.
export default withSentryConfig(nextConfig, {
  org: "dragonflailabs",
  project: "musicaleando-admin",
  silent: !process.env.CI,
});

// Lets `npm run dev` (next dev) resolve Cloudflare bindings the same way the
// deployed Worker will, instead of only finding out about a missing/misused
// binding at deploy time.
initOpenNextCloudflareForDev();
