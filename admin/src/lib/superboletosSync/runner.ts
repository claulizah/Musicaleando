import type { Browser } from 'playwright-core';
import { esFechaFutura, esMusicaVigente, parseSearchEntry, type RawSearchEntry, type SuperboletosEvent } from './extract';

// Nunca se llama al endpoint interno de AWS (API Gateway + Cognito) ni se
// usa ninguna credencial/API key encontrada en el código del sitio. Lo único
// que hace este archivo es un `page.goto()` normal a una página pública del
// sitio (`/busqueda`), exactamente como lo haría cualquier visitante — el
// PROPIO sitio, con su PROPIA sesión, es quien llama a ese endpoint para
// traer los datos que va a mostrar. Este código solo ESCUCHA la respuesta
// que ya le llegó al navegador (`page.on('response', ...)`), igual que se
// haría inspeccionando el tráfico de red de cualquier sitio con las
// herramientas de desarrollador — nunca construye esa URL, nunca agrega un
// header de autorización, nunca lee ni reenvía ningún token.
//
// Investigado y confirmado en vivo (ver el reporte del ticket): la
// respuesta de `catalogos/search.json` trae el catálogo COMPLETO del sitio
// (los ~1180 eventos de las 32 regiones, sin importar el parámetro
// `region` de la URL ni qué pestaña de categoría esté seleccionada — el
// filtrado por región/categoría lo hace el propio sitio en el navegador,
// después de traer todo). Por eso una sola carga de página basta: no hace
// falta navegar región por región ni simular ningún clic.

const SEARCH_JSON_URL_FRAGMENT = 'catalogos/search.json';
const PAGE_TIMEOUT_MS = 30000;

export type SuperboletosSyncResult = {
  eventos: SuperboletosEvent[];
  totalEnRespuesta: number;
  error?: string;
};

export async function runSuperboletosSync(browser: Browser): Promise<SuperboletosSyncResult> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    let raw: Record<string, RawSearchEntry> | null = null;
    page.on('response', async (res) => {
      if (raw || !res.url().includes(SEARCH_JSON_URL_FRAGMENT)) return;
      try {
        raw = (await res.json()) as Record<string, RawSearchEntry>;
      } catch {
        // Una respuesta que no es JSON válido simplemente se ignora — el
        // wait de abajo agota su tiempo y se reporta como error.
      }
    });

    await page.goto('https://www.superboletos.com/busqueda', { waitUntil: 'networkidle', timeout: PAGE_TIMEOUT_MS });
    // networkidle ya implica que la respuesta llegó, pero por si el listener
    // aún no terminó de parsear el body cuando networkidle se resuelve.
    for (let i = 0; i < 20 && !raw; i++) await page.waitForTimeout(250);

    if (!raw) {
      return { eventos: [], totalEnRespuesta: 0, error: 'No se recibió la respuesta de catalogos/search.json a tiempo.' };
    }

    const entries: RawSearchEntry[] = Object.values(raw);
    const hoy = new Date().toISOString().slice(0, 10);
    const eventos = entries
      .filter(esMusicaVigente)
      .map(parseSearchEntry)
      .filter((e) => esFechaFutura(e.fecha_iso, hoy));

    return { eventos, totalEnRespuesta: entries.length };
  } catch (err) {
    return { eventos: [], totalEnRespuesta: 0, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await context.close();
  }
}
