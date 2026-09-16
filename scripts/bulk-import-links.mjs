// One-time manual script: bulk-loads already-published events from
// API-less boleteras into the /candidatos queue for review. NOT wired to
// any cron, NOT exposed in the admin UI — run it by hand from a terminal
// whenever there's another big backlog to catch up on:
//
//   node scripts/bulk-import-links.mjs urls.txt
//
// urls.txt: one URL per line (blank lines and lines starting with # are
// ignored). Talks to the bulk-import-links Edge Function, which is gated by
// a shared secret (BULK_IMPORT_SECRET), not an admin session — see that
// function's header comment for why.

import { readFileSync } from 'node:fs';

const SUPABASE_URL = 'https://ijwyykfuyeaahvxmaild.supabase.co';
const IMPORT_SECRET = process.env.BULK_IMPORT_SECRET;
const CHUNK_SIZE = 20; // matches the Edge Function's MAX_URLS_PER_CALL

if (!IMPORT_SECRET) {
  console.error('Falta la variable de entorno BULK_IMPORT_SECRET.');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Uso: node scripts/bulk-import-links.mjs <archivo-de-urls.txt>');
  process.exit(1);
}

const urls = readFileSync(inputPath, 'utf-8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

const uniqueUrls = [...new Set(urls)];
if (uniqueUrls.length !== urls.length) {
  console.log(`(${urls.length - uniqueUrls.length} URL(s) duplicada(s) en el archivo, se ignoraron)`);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const allResults = [];
  const chunks = chunk(uniqueUrls, CHUNK_SIZE);
  console.log(`Procesando ${uniqueUrls.length} URLs en ${chunks.length} lote(s) de hasta ${CHUNK_SIZE}...`);

  for (let i = 0; i < chunks.length; i++) {
    console.log(`\n--- Lote ${i + 1}/${chunks.length} (${chunks[i].length} URLs) ---`);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/bulk-import-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-import-secret': IMPORT_SECRET },
      body: JSON.stringify({ urls: chunks[i] }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`Lote ${i + 1} falló completo: HTTP ${res.status}`, body);
      for (const url of chunks[i]) allResults.push({ url, error: `Lote falló: HTTP ${res.status}`, eventsFound: 0, created: 0, skippedDuplicates: 0 });
      continue;
    }
    for (const r of body.results) {
      allResults.push(r);
      if (r.error) {
        console.log(`  ✗ ${r.url}\n    ${r.error}`);
      } else {
        console.log(`  ✓ ${r.url} — ${r.eventsFound} evento(s) encontrados, ${r.created} nuevo(s), ${r.skippedDuplicates} duplicado(s) omitido(s)`);
        if (r.insertErrors) for (const e of r.insertErrors) console.log(`      ! ${e}`);
      }
    }
  }

  const totals = allResults.reduce(
    (acc, r) => ({
      created: acc.created + r.created,
      skipped: acc.skipped + r.skippedDuplicates,
      failed: acc.failed + (r.error ? 1 : 0),
      ok: acc.ok + (r.error ? 0 : 1),
    }),
    { created: 0, skipped: 0, failed: 0, ok: 0 },
  );

  console.log('\n=== RESUMEN ===');
  console.log(`URLs procesadas sin error: ${totals.ok}/${allResults.length}`);
  console.log(`URLs que fallaron: ${totals.failed}`);
  console.log(`Candidatos nuevos creados (pendientes en /candidatos): ${totals.created}`);
  console.log(`Duplicados omitidos (ya existían): ${totals.skipped}`);

  if (totals.failed > 0) {
    console.log('\nURLs que fallaron:');
    for (const r of allResults.filter((r) => r.error)) console.log(`  - ${r.url}: ${r.error}`);
  }
}

main().catch((e) => {
  console.error('Error del script:', e);
  process.exit(1);
});
