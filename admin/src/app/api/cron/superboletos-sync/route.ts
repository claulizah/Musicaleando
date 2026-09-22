import { NextRequest, NextResponse } from 'next/server';

// ⛔ APAGADO A PROPÓSITO — parte del ticket "Superboletos: preparar
// navegador headless (NO activar)". Esta ruta responde "disabled" sin
// lanzar ningún navegador mientras SUPERBOLETOS_SYNC_ENABLED no sea "true"
// (esa variable no está configurada en ningún entorno hoy). Tampoco hay
// ninguna entrada de cron en vercel.json que la llame — activar esto
// requiere las TRES cosas a la vez: (1) validar los selectores de
// runner.ts contra el sitio real desde una red que pueda cargarlo, (2)
// poner SUPERBOLETOS_SYNC_ENABLED=true y SUPERBOLETOS_SYNC_SECRET en
// Vercel, (3) agregar la entrada de cron en vercel.json. Ver el reporte del
// ticket para el checklist completo y las dudas abiertas (si el IP de
// Vercel también choca con el bloqueo de bots del sitio).
export async function POST(req: NextRequest) {
  if (process.env.SUPERBOLETOS_SYNC_ENABLED !== 'true') {
    return NextResponse.json({ disabled: true, message: 'Superboletos sync está apagado a propósito.' });
  }

  const secret = process.env.SUPERBOLETOS_SYNC_SECRET;
  if (!secret || req.headers.get('x-sync-secret') !== secret) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const chromium = (await import('@sparticuz/chromium')).default;
    const { chromium: playwright } = await import('playwright-core');
    const { runSuperboletosSync } = await import('@/lib/superboletosSync/runner');

    const browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    try {
      const results = await runSuperboletosSync(browser);
      // TODO: cuando esto se active de verdad, aquí va el mismo pipeline
      // que eticket-sync — resolveEstado/título ya vienen aplicados en
      // extract.ts, falta el upsert a event_candidates (source: 'superboletos')
      // y la detección de duplicados contra `festivals` (findPossibleDuplicate
      // ya existe en extract.ts, reusar tal cual).
      return NextResponse.json({
        regiones: results.length,
        eventos_encontrados: results.reduce((n, r) => n + r.eventos.length, 0),
        regiones_con_error: results.filter((r) => r.error).map((r) => ({ estado: r.region.estado, error: r.error })),
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
