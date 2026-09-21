import { supabase } from './supabase';
import type { TicketPlatform } from './ticketLinks';

// Registro de clics en "Comprar boletos" — a propósito NO devuelve una
// promesa ni se espera: el salto al link de compra debe ser inmediato, y si
// el registro falla (sin red, RLS) simplemente se pierde ese clic, nunca se
// bloquea ni se le muestra nada al usuario. Solo se guarda evento,
// plataforma, si llevó afiliado y el identificador anónimo de la sesión.
export function trackTicketClick(
  festivalId: string,
  userId: string | null,
  plataforma: TicketPlatform,
  afiliado: boolean,
): void {
  supabase
    .from('ticket_clicks')
    .insert({ festival_id: festivalId, user_id: userId, plataforma, afiliado })
    .then(
      ({ error }) => {
        if (error) console.warn('No se pudo registrar el clic de compra (no bloqueante):', error.message);
      },
      () => {},
    );
}
