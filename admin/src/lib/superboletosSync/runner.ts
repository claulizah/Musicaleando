import type { Browser, Page } from 'playwright-core';
import { fetchRegions, type Region } from './regions';
import { MUSIC_CATEGORIES, parseCityState, pareceMusica, titleCaseIfShouting, type SuperboletosEvent } from './extract';

// Selectores confirmados EN VIVO (inspeccionando el DOM real con Playwright
// contra superboletos.com, ver el reporte del ticket) — a diferencia de la
// primera versión de este archivo, ya no son una suposición. Son clases CSS
// generadas (Emotion/MUI, ej. "cardEvent_card-container__79Hv4") — el sufijo
// hash cambia en cada build del sitio, por eso se usa `[class*="…"]`
// (contiene) en vez de la clase completa, para no depender del hash exacto.
const CARD_SELECTOR = '[class*="cardEvent_card-container"]';
const VENUE_SELECTOR = 'h4[class*="card-event-estadium"]';
const NOMBRE_SELECTOR = 'h4[class*="event-info"]';
// La tarjeta trae 3 <h4> en orden fijo (venue, "ciudad, estado", nombre) y
// un solo <h5> (fecha) sin clase propia — no hay un selector de clase para
// "ciudad, estado" ni para la fecha, así que se toman por posición.
const CIUDAD_ESTADO_INDEX = 1;

const REQUEST_SPACING_MS = 3000; // cortesía entre regiones — no es una API pensada para esto
const PAGE_TIMEOUT_MS = 25000;

export type RegionResult = {
  region: Region;
  eventos: SuperboletosEvent[];
  error?: string;
};

type ExtractOptions = {
  // Clic por tarjeta para obtener el link real de compra (lento: navega,
  // regresa y espera por cada evento — ver medición real en el reporte del
  // ticket). Sin esto, `link` queda en null y Claudia lo agrega a mano al
  // aprobar, igual que ya pasa hoy con los candidatos de póster.
  obtenerLinks?: boolean;
};

async function extractRegion(page: Page, region: Region, opts: ExtractOptions): Promise<RegionResult> {
  const eventos: SuperboletosEvent[] = [];
  try {
    await page.goto(`https://www.superboletos.com/busqueda?region=${region.regionId}`, {
      waitUntil: 'networkidle',
      timeout: PAGE_TIMEOUT_MS,
    });
    await page.waitForTimeout(1500); // deja asentar el primer render antes de filtrar

    for (const categoria of MUSIC_CATEGORIES) {
      const tab = page.getByText(categoria, { exact: true }).first();
      if ((await tab.count()) === 0) continue;
      await tab.click();
      await page.waitForTimeout(1500); // deja que la lista re-renderice tras el filtro

      const cards = page.locator(CARD_SELECTOR);
      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        const venue = (await card.locator(VENUE_SELECTOR).textContent().catch(() => null))?.trim() || null;
        const ciudadEstadoRaw = (await card.locator('h4').nth(CIUDAD_ESTADO_INDEX).textContent().catch(() => null))?.trim();
        const nombreRaw = (await card.locator(NOMBRE_SELECTOR).textContent().catch(() => null))?.trim();
        const fecha_texto = (await card.locator('h5').first().textContent().catch(() => null))?.trim() || null;
        if (!nombreRaw || !ciudadEstadoRaw) continue;

        const nombre = titleCaseIfShouting(nombreRaw);
        if (!pareceMusica(nombre)) continue;
        const { ciudad, estado } = parseCityState(ciudadEstadoRaw);

        let link: string | null = null;
        if (opts.obtenerLinks) {
          // Las tarjetas son <div onClick>, no <a href> — no hay forma de leer
          // el link sin hacer clic (confirmado en vivo: el id del evento solo
          // existe en memoria de React, nunca en el DOM). Clic, se captura la
          // URL a la que navega, y se regresa a la lista para seguir leyendo.
          const before = page.url();
          try {
            await card.click({ timeout: 5000 });
            await page.waitForURL(/\/landing-evento\//, { timeout: 8000 });
            link = page.url();
          } catch {
            link = null;
          } finally {
            if (page.url() !== before) {
              await page.goBack({ waitUntil: 'networkidle', timeout: PAGE_TIMEOUT_MS }).catch(() => {});
              await page.waitForTimeout(500);
              // Al volver, hay que re-seleccionar la pestaña de categoría —
              // "TODOS" es el estado con el que carga la página siempre.
              await page.getByText(categoria, { exact: true }).first().click().catch(() => {});
              await page.waitForTimeout(1200);
            }
          }
        }

        eventos.push({ nombre, fecha_texto, venue, ciudad, estado, link });
      }
    }
  } catch (err) {
    return { region, eventos, error: err instanceof Error ? err.message : String(err) };
  }
  return { region, eventos };
}

// Nunca llama al endpoint interno de AWS (API Gateway + Cognito) ni usa
// ninguna credencial encontrada en el código del sitio — solo lee lo que el
// navegador ya renderizó, como lo vería una persona (incluido el link: se
// obtiene navegando de verdad, nunca reconstruyendo la URL a mano). Nunca
// escribe en la base — devuelve lo que encontró; guardar como candidatos es
// responsabilidad de quien llame a esto (mismo reparto que eticket-sync).
export async function runSuperboletosSync(
  browser: Browser,
  opts: ExtractOptions & { regionesFiltro?: string[] } = {},
): Promise<RegionResult[]> {
  const regions = await fetchRegions();
  const scoped = opts.regionesFiltro ? regions.filter((r) => opts.regionesFiltro!.includes(r.estado)) : regions;

  const results: RegionResult[] = [];
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    for (let i = 0; i < scoped.length; i++) {
      if (i > 0) await page.waitForTimeout(REQUEST_SPACING_MS);
      results.push(await extractRegion(page, scoped[i], opts));
    }
  } finally {
    await context.close();
  }
  return results;
}
