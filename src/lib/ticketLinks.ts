export type TicketPlatform = 'ticketmaster' | 'frontgate' | 'eticket' | 'superboletos' | 'otro';

export function detectTicketPlatform(rawUrl: string): TicketPlatform {
  let host = '';
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return 'otro';
  }
  if (host === 'ticketmaster.com.mx' || host.endsWith('.ticketmaster.com.mx') || host === 'ticketmaster.com' || host.endsWith('.ticketmaster.com')) {
    return 'ticketmaster';
  }
  if (host === 'fgtix.com' || host.endsWith('.fgtix.com')) return 'frontgate';
  if (host === 'eticket.mx' || host.endsWith('.eticket.mx')) return 'eticket';
  if (host === 'superboletos.com' || host.endsWith('.superboletos.com')) return 'superboletos';
  return 'otro';
}

// Único lugar donde se arma el link final de "Comprar boletos". La plantilla
// de afiliado viene de app_config (la pega Claudia desde el admin cuando
// tenga su cuenta de afiliado, sin release nuevo) y lleva {url} donde va el
// link original ya codificado, ej. el formato típico de Impact:
// https://ticketmaster.evyy.net/c/<partner>/<ad>/<programa>?u={url}
// Solo se aplica a Ticketmaster (el programa de afiliados cubre esa
// plataforma) y nunca a un link que ya viene envuelto. Sin plantilla, o con
// una plantilla inválida, devuelve el link original sin tocar.
export function buildTicketUrl(
  rawUrl: string,
  affiliateTemplate: string | null,
): { url: string; plataforma: TicketPlatform; afiliado: boolean } {
  const plataforma = detectTicketPlatform(rawUrl);
  const template = affiliateTemplate?.trim() ?? '';
  const applicable =
    plataforma === 'ticketmaster' &&
    template.startsWith('https://') &&
    template.includes('{url}') &&
    !rawUrl.includes('evyy.net');
  if (!applicable) return { url: rawUrl, plataforma, afiliado: false };
  return { url: template.replace('{url}', encodeURIComponent(rawUrl)), plataforma, afiliado: true };
}
