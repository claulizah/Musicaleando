// Sin importar lineupSchedule: la resolución de módulos del app (sin extensión)
// no es la de los tests de Node. Misma regla que hasRealHorario: una hora
// exactamente 00:00 significa "solo se sabe el día".
function hasRealHorario(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && !(d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0);
}

// "Mi horario": detecta traslapes entre los artistas que el usuario marcó
// como "quiero verlo". Solo AVISA — nunca resuelve ni elimina nada.
//
// Un set sin hora de fin (lo común: muchos carteles solo traen la hora de
// inicio) se asume de DEFAULT_MINUTOS de duración para poder compararlo;
// una fila sin hora real no se compara (no se inventa un horario). Dos sets
// que solo se tocan en el borde (uno termina 21:00, el otro empieza 21:00) no
// son conflicto. Las horas se comparan tal cual están guardadas (hora de
// pared del cartel, ver lineupSchedule.ts), así que no importa la zona horaria.
export const DEFAULT_MINUTOS = 60;

type Pick = { id: string; horario: string | null; horario_fin?: string | null };

function range(p: Pick): [number, number] | null {
  if (!hasRealHorario(p.horario)) return null;
  const start = new Date(p.horario!).getTime();
  if (Number.isNaN(start)) return null;
  const rawEnd = hasRealHorario(p.horario_fin) ? new Date(p.horario_fin!).getTime() : NaN;
  const end = !Number.isNaN(rawEnd) && rawEnd > start ? rawEnd : start + DEFAULT_MINUTOS * 60_000;
  return [start, end];
}

// id -> ids con los que se traslapa (solo entradas con al menos un conflicto).
export function findConflicts(picks: Pick[]): Map<string, string[]> {
  const ranges = picks
    .map((p) => ({ id: p.id, r: range(p) }))
    .filter((x): x is { id: string; r: [number, number] } => x.r !== null);
  const result = new Map<string, string[]>();
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i];
      const b = ranges[j];
      if (a.r[0] < b.r[1] && b.r[0] < a.r[1]) {
        result.set(a.id, [...(result.get(a.id) ?? []), b.id]);
        result.set(b.id, [...(result.get(b.id) ?? []), a.id]);
      }
    }
  }
  return result;
}
