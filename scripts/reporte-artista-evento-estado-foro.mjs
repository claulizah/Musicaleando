// Genera 3 CSV (UTF-8 con BOM, RFC 4180 — abren bien en Excel/Sheets) a partir de
// scripts/reporte-artista-evento-estado-foro.sql. Solo lectura.
// Uso: node scripts/reporte-artista-evento-estado-foro.mjs [carpeta-de-salida]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });
const sql = readFileSync(new URL('./reporte-artista-evento-estado-foro.sql', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

// La CLI devuelve las columnas en orden alfabético (jsonb): se fija el orden de lectura aquí.
const COLS = {
  filas: ['artista', 'evento', 'estado', 'foro', 'ciudad', 'fecha_inicio', 'fecha_fin', 'tipo', 'estado_evento', 'fuente', 'festival_id'],
  sinArtista: ['nombre', 'ciudad', 'fecha_inicio', 'tipo', 'estado_evento', 'filas_lineup', 'estado', 'foro', 'fuente', 'festival_id'],
  sinVenue: ['nombre', 'ciudad', 'fecha_inicio', 'tipo', 'estado_evento', 'fuente', 'festival_id'],
};

const run = (q) => {
  const f = join(tmpdir(), `rep-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(f, q + ';');
  const out = execFileSync('npx', ['supabase', 'db', 'query', '--linked', '--file', f], { encoding: 'utf8', shell: true });
  return JSON.parse(out.slice(out.indexOf('{'))).rows;
};
const esc = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows, cols) =>
  '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');

const [filas, sinArtista, sinVenue, cobertura] = sql.map(run);
const hoy = new Date().toISOString().slice(0, 10);
writeFileSync(join(outDir, `musicaleando-artista-evento-estado-foro-${hoy}.csv`), csv(filas, COLS.filas));
writeFileSync(join(outDir, `musicaleando-huecos-sin-artista-${hoy}.csv`), csv(sinArtista, COLS.sinArtista));
writeFileSync(join(outDir, `musicaleando-huecos-sin-venue-${hoy}.csv`), csv(sinVenue, COLS.sinVenue));
console.log('cobertura:', JSON.stringify(cobertura[0]));
console.log('filas reporte:', filas.length, '| sin artista:', sinArtista.length, '| sin venue:', sinVenue.length);
