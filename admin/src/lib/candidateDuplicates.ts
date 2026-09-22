// Lógica pura de detección de duplicados para el flujo de imagen/link —
// separada de candidatos/actions.ts porque ese archivo lleva 'use server' y
// Next.js solo permite exportar funciones async ahí (esta es síncrona, y
// necesita poder importarse desde pruebas con Node).

// 'archivado' = mismo nombre que un evento ya vencido/archivado pero otra
// fecha (probable re-anuncio, ej. una gira nueva del mismo artista) — es solo
// una pista informativa, no bloquea ni desmarca la creación como sí hacen
// 'festival'/'candidate' (mismo evento, misma fecha).
export type DuplicateMatch = {
  type: 'festival' | 'candidate' | 'archivado';
  id: string;
  nombre: string;
  fecha_inicio?: string | null;
};

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Mismo criterio de dedup que ticketmaster-sync (nombre normalizado que se
// contiene mutuamente + fecha dentro de 1 día + ciudad que se contiene
// mutuamente cuando ambas existen) — porteado a TS porque las Edge Functions
// (Deno) y los server actions de Next no comparten módulos en este repo. A
// diferencia del sync de Ticketmaster, aquí también se revisa contra otros
// candidatos pendientes (de cualquier fuente), no solo contra festivals ya
// aprobados — un póster puede describir el mismo evento que ya sincronizó
// Ticketmaster y sigue sin aprobarse.
export function findDuplicateMatch(
  event: { nombre: string; ciudad: string | null; fecha_inicio: string | null },
  festivals: { id: string; nombre: string; ciudad: string; fecha_inicio: string; estado_evento?: string }[],
  candidates: { id: string; nombre: string; ciudad: string | null; fecha_inicio: string | null }[],
): DuplicateMatch | null {
  const normName = normalizeText(event.nombre);

  const namesAndDatesMatch = (nombre: string, ciudad: string | null, fecha_inicio: string | null) => {
    const normOther = normalizeText(nombre);
    const namesMatch = normName === normOther || normName.includes(normOther) || normOther.includes(normName);
    if (!namesMatch) return false;
    if (event.fecha_inicio && fecha_inicio) {
      const diffDays = Math.abs(new Date(event.fecha_inicio).getTime() - new Date(fecha_inicio).getTime()) / 86_400_000;
      if (diffDays > 1) return false;
    }
    if (event.ciudad && ciudad) {
      const ciudadesMatch =
        normalizeText(event.ciudad).includes(normalizeText(ciudad)) ||
        normalizeText(ciudad).includes(normalizeText(event.ciudad));
      if (!ciudadesMatch) return false;
    }
    return true;
  };

  for (const f of festivals) {
    if (namesAndDatesMatch(f.nombre, f.ciudad, f.fecha_inicio)) {
      return { type: 'festival', id: f.id, nombre: f.nombre };
    }
  }
  for (const c of candidates) {
    if (namesAndDatesMatch(c.nombre, c.ciudad, c.fecha_inicio)) {
      return { type: 'candidate', id: c.id, nombre: c.nombre };
    }
  }
  // Ninguno coincide en fecha: buscar en el historial archivado el MISMO
  // nombre (igualdad exacta normalizada, no "contiene" — sin el ancla de la
  // fecha, "contiene" daría demasiado ruido) para avisar de un probable
  // re-anuncio en vez de crear un registro sin relación con el anterior.
  for (const f of festivals) {
    if (f.estado_evento === 'archivado' && normalizeText(f.nombre) === normName) {
      return { type: 'archivado', id: f.id, nombre: f.nombre, fecha_inicio: f.fecha_inicio };
    }
  }
  return null;
}
