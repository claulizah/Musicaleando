export type ClickRow = { festival_id: string | null; plataforma: string; afiliado: boolean; created_at: string };

const MX_TZ = 'America/Mexico_City';

function mexicoDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: MX_TZ });
}

// Lunes de la semana (en hora de México) de una fecha AAAA-MM-DD.
export function weekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

export type Report = {
  weeks: string[];
  byEvent: { festival_id: string | null; total: number; perWeek: number[] }[];
  byPlatform: { plataforma: string; total: number; conAfiliado: number }[];
  last7: number;
  last30: number;
  total: number;
};

export function buildReport(rows: ClickRow[], weeksBack = 6, now = new Date()): Report {
  const thisWeek = weekStart(mexicoDate(now.toISOString()));
  const weeks: string[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const [y, m, d] = thisWeek.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d - 7 * i));
    weeks.push(dt.toISOString().slice(0, 10));
  }

  const perEvent = new Map<string | null, number[]>();
  const perPlatform = new Map<string, { total: number; conAfiliado: number }>();
  let last7 = 0;
  let last30 = 0;

  for (const r of rows) {
    const ageDays = (now.getTime() - new Date(r.created_at).getTime()) / 86_400_000;
    if (ageDays <= 7) last7++;
    if (ageDays <= 30) last30++;

    const p = perPlatform.get(r.plataforma) ?? { total: 0, conAfiliado: 0 };
    p.total++;
    if (r.afiliado) p.conAfiliado++;
    perPlatform.set(r.plataforma, p);

    const idx = weeks.indexOf(weekStart(mexicoDate(r.created_at)));
    if (idx === -1) continue;
    const arr = perEvent.get(r.festival_id) ?? new Array(weeks.length).fill(0);
    arr[idx]++;
    perEvent.set(r.festival_id, arr);
  }

  const byEvent = [...perEvent.entries()]
    .map(([festival_id, perWeek]) => ({ festival_id, perWeek, total: perWeek.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total);
  const byPlatform = [...perPlatform.entries()]
    .map(([plataforma, v]) => ({ plataforma, ...v }))
    .sort((a, b) => b.total - a.total);

  return { weeks, byEvent, byPlatform, last7, last30, total: rows.length };
}
