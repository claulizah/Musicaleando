// Genera el SQL de backfill de `venues` a partir de los festivales ya
// aprobados (activos y archivados). El nombre y ciudad del lugar de cada
// evento no se guardaban en `festivals` (solo en el `event_candidates` que
// lo originó, vía festival_id) — esa es la única fuente real que existe, y
// es de ahí que sale este backfill.
//
// El estado se calcula con resolveEstado(), el MISMO mapeo ciudad→estado
// que ya usa el admin para agrupar (admin/src/lib/mexicoEstados.ts) — no se
// reimplementa ni se inventa uno nuevo.
//
// Uso:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generate-venues-backfill.mts <entrada.json> > backfill.sql
// donde <entrada.json> es la salida de:
//   select f.id as festival_id, ec.venue, f.ciudad
//   from festivals f join event_candidates ec on ec.festival_id = f.id
//   where f.estado_evento in ('activo','archivado')
//     and ec.venue is not null and trim(ec.venue) <> '';
// (envuelta en el JSON que devuelve `supabase db query --linked`, o una
// lista plana — ambas formas se aceptan).
//
// El .sql generado se revisa a mano y se corre con:
//   npx supabase db query --linked -f backfill.sql

import { readFileSync } from 'node:fs';
import { resolveEstado, OTRO_ESTADO_LABEL } from '../admin/src/lib/mexicoEstados.ts';

type Row = { festival_id: string; venue: string; ciudad: string };

function normalizeVenueName(name: string, city: string): string {
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  return `${norm(name)}|${norm(city)}`;
}

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Uso: generate-venues-backfill.mts <entrada.json>');
    process.exit(1);
  }
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw.slice(raw.indexOf(raw.trimStart()[0] === '[' ? '[' : '{')));
  const rows: Row[] = Array.isArray(parsed) ? parsed : parsed.rows;

  // Un venue por combinación única de nombre+ciudad (texto tal cual viene
  // del primer candidato que se encuentra con esa combinación — no se
  // re-castea capitalización aquí, mismo criterio que artists.ts).
  const venueByKey = new Map<string, { name: string; city: string; state: string }>();
  const festivalToVenueKey = new Map<string, string>();
  const otroEstado: { name: string; city: string }[] = [];

  for (const r of rows) {
    const name = r.venue.trim();
    const city = r.ciudad.trim();
    if (!name || !city) continue;
    const key = normalizeVenueName(name, city);
    if (!venueByKey.has(key)) {
      const state = resolveEstado(city);
      venueByKey.set(key, { name, city, state });
      if (state === OTRO_ESTADO_LABEL) otroEstado.push({ name, city });
    }
    festivalToVenueKey.set(r.festival_id, key);
  }

  console.error(`-- venues únicos: ${venueByKey.size}`);
  console.error(`-- festivales a vincular: ${festivalToVenueKey.size}`);
  console.error(`-- con estado "${OTRO_ESTADO_LABEL}": ${otroEstado.length}`);
  for (const o of otroEstado) console.error(`--   - ${o.name} (${o.city})`);

  const lines: string[] = [];
  lines.push('-- Generado por scripts/generate-venues-backfill.mts — revisar antes de correr.');
  lines.push('begin;');
  lines.push('insert into public.venues (name, city, state, normalized_name) values');
  const values = [...venueByKey.entries()].map(
    ([key, v]) => `  (${sqlString(v.name)}, ${sqlString(v.city)}, ${sqlString(v.state)}, ${sqlString(key)})`,
  );
  lines.push(values.join(',\n') + '\non conflict (normalized_name) do nothing;');
  lines.push('');
  lines.push('update public.festivals f set venue_id = v.id');
  lines.push('from public.venues v');
  lines.push('where f.venue_id is null and f.id in (');
  lines.push('  select unnest(array[' + [...festivalToVenueKey.keys()].map(sqlString).join(',') + ']::uuid[])');
  lines.push(') and v.normalized_name = case f.id');
  for (const [festivalId, key] of festivalToVenueKey) {
    lines.push(`  when ${sqlString(festivalId)}::uuid then ${sqlString(key)}`);
  }
  lines.push('  else null end;');
  lines.push('commit;');

  console.log(lines.join('\n'));
}

main();
