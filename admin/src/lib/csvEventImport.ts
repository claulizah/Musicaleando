// Lógica pura de la importación masiva de eventos desde CSV — sin tocar la
// base ni Next, para poder probarla directamente con el CSV real de la
// curadora y con el catálogo real (ver la verificación en el ticket).

export type EventoTipo = 'concierto' | 'festival';

export type CsvEventRow = {
  nombre: string;
  tipo: EventoTipo;
  ciudad: string;
  fecha_inicio: string;
  fecha_fin: string;
  link_boletos: string | null;
};

export type ExistingFestival = {
  id: string;
  nombre: string;
  ciudad: string;
  fecha_inicio: string;
  estado_evento: string;
};

// ok                    -> se puede importar tal cual
// reanuncio_archivado   -> mismo nombre que un evento archivado pero otra
//                          fecha (probable re-anuncio); informativo, se
//                          importa por default
// duplicado_activo      -> ya existe el mismo evento (mismo nombre/fecha/
//                          ciudad, o el mismo id) en el catálogo activo
// duplicado_archivado   -> lo mismo, pero contra el historial archivado
// duplicado_en_archivo  -> repetido dentro del propio CSV
// error                 -> fila inválida, no se puede importar
export type RowStatus =
  | 'ok'
  | 'reanuncio_archivado'
  | 'duplicado_activo'
  | 'duplicado_archivado'
  | 'duplicado_en_archivo'
  | 'error';

export type PreviewRow = {
  line: number; // número de línea en el archivo (1 = primera línea)
  raw: string[];
  status: RowStatus;
  messages: string[];
  row?: CsvEventRow; // solo si pasó la validación (todo status excepto 'error')
};

export type ParseResult =
  | { ok: true; rows: PreviewRow[]; usedHeaderless: boolean; ignoredIdColumn: boolean }
  | { ok: false; error: string };

// ---------- CSV ----------

function detectDelimiter(text: string): string {
  // Excel en configuración regional es-MX a veces exporta con ';'.
  const firstLine = text.split(/\r?\n/).find((l) => l.replace(/[,;\s]/g, '').length > 0) ?? '';
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ',') commas++;
    else if (!inQuotes && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

// CSV estilo RFC 4180: campos entre comillas, "" como comilla literal, y
// saltos de línea dentro de comillas. Devuelve también el número de línea
// (1-based) donde empieza cada registro, para reportar errores con su fila.
export function parseCsv(input: string): { records: string[][]; lines: number[] } {
  const text = input.replace(/^﻿/, '');
  const delim = detectDelimiter(text);
  const records: string[][] = [];
  const lines: number[] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;

  const endRecord = () => {
    record.push(field);
    field = '';
    records.push(record);
    lines.push(recordStartLine);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordStartLine = line;
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || record.length > 0) endRecord();
  return { records, lines };
}

// ---------- Encabezados ----------

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

type Field = 'id' | 'nombre' | 'tipo' | 'ciudad' | 'fecha_inicio' | 'fecha_fin' | 'link_boletos';

const HEADER_SYNONYMS: Record<string, Field> = {
  id: 'id',
  nombre: 'nombre',
  evento: 'nombre',
  name: 'nombre',
  tipo: 'tipo',
  tipo_evento: 'tipo',
  ciudad: 'ciudad',
  city: 'ciudad',
  fecha_inicio: 'fecha_inicio',
  inicio: 'fecha_inicio',
  fecha: 'fecha_inicio',
  fecha_fin: 'fecha_fin',
  fin: 'fecha_fin',
  link_boletos: 'link_boletos',
  link: 'link_boletos',
  boletos: 'link_boletos',
  url: 'link_boletos',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// La hoja real de la curadora se exporta SIN fila de encabezados (la primera
// línea son solo comas vacías). Si no hay encabezados reconocibles, se
// asume el orden de columnas del catálogo — solo si la forma de la primera
// fila de datos lo respalda (7 columnas con un UUID al inicio = con id; 6
// columnas = sin id); si no, se pide arreglar el archivo en vez de adivinar.
function resolveColumns(
  first: string[],
): { map: Field[]; consumesHeader: boolean; headerless: boolean } | { error: string } {
  const mapped = first.map((h) => HEADER_SYNONYMS[normalizeHeader(h)] ?? null);
  if (mapped.includes('nombre')) {
    return { map: mapped.map((m) => m ?? ('' as Field)), consumesHeader: true, headerless: false };
  }
  const cells = first.map((c) => c.trim());
  if (cells.length === 7 && UUID_RE.test(cells[0])) {
    return {
      map: ['id', 'nombre', 'tipo', 'ciudad', 'fecha_inicio', 'fecha_fin', 'link_boletos'],
      consumesHeader: false,
      headerless: true,
    };
  }
  if (cells.length === 6) {
    return {
      map: ['nombre', 'tipo', 'ciudad', 'fecha_inicio', 'fecha_fin', 'link_boletos'],
      consumesHeader: false,
      headerless: true,
    };
  }
  return {
    error:
      'No se reconocieron los encabezados. La primera fila debe ser: nombre, tipo_evento, ciudad, fecha_inicio, fecha_fin, link_boletos (la columna id es opcional y se ignora).',
  };
}

// ---------- Validación de una fila ----------

export function isValidIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function normalizeTipo(raw: string): EventoTipo | null {
  const t = normalizeHeader(raw);
  if (t === '') return 'concierto'; // default: celda vacía = concierto
  if (t === 'concierto') return 'concierto';
  if (t === 'festival') return 'festival';
  return null;
}

export function validateRow(
  values: Partial<Record<Field, string>>,
): { row: CsvEventRow } | { errors: string[] } {
  const errors: string[] = [];
  const nombre = (values.nombre ?? '').trim();
  const ciudad = (values.ciudad ?? '').trim();
  const fechaInicio = (values.fecha_inicio ?? '').trim();
  const fechaFinRaw = (values.fecha_fin ?? '').trim();
  const linkRaw = (values.link_boletos ?? '').trim();

  if (!nombre) errors.push('Falta el nombre.');
  if (!ciudad) errors.push('Falta la ciudad.');

  const fecha_inicio = fechaInicio;
  if (!fechaInicio) {
    errors.push('Falta la fecha de inicio.');
  } else if (!isValidIsoDate(fechaInicio)) {
    errors.push(`Fecha de inicio inválida "${fechaInicio}" (formato AAAA-MM-DD).`);
  }

  // Igual que al aprobar candidatos: un evento de un día no trae fecha_fin.
  const fecha_fin = fechaFinRaw || fechaInicio;
  if (fechaFinRaw && !isValidIsoDate(fechaFinRaw)) {
    errors.push(`Fecha de fin inválida "${fechaFinRaw}" (formato AAAA-MM-DD).`);
  } else if (isValidIsoDate(fecha_inicio) && isValidIsoDate(fecha_fin) && fecha_fin < fecha_inicio) {
    errors.push('La fecha de fin es anterior a la de inicio.');
  }

  const tipo = normalizeTipo(values.tipo ?? '');
  if (tipo === null) errors.push(`tipo_evento desconocido "${(values.tipo ?? '').trim()}" (debe ser concierto o festival).`);

  let link_boletos: string | null = null;
  if (linkRaw) {
    try {
      const u = new URL(linkRaw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo');
      link_boletos = linkRaw;
    } catch {
      errors.push(`Link de boletos inválido "${linkRaw}".`);
    }
  }

  if (errors.length > 0 || tipo === null) return { errors };
  return { row: { nombre, tipo, ciudad, fecha_inicio, fecha_fin, link_boletos } };
}

// ---------- Duplicados ----------

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Mismo criterio que ticketmaster-sync / findDuplicateMatch del admin: nombre
// normalizado que se contiene mutuamente + fecha de inicio dentro de 1 día +
// ciudad que se contiene mutuamente cuando ambas existen.
function sameEvent(a: { nombre: string; ciudad: string; fecha_inicio: string }, b: { nombre: string; ciudad: string; fecha_inicio: string }): boolean {
  const na = normalizeText(a.nombre);
  const nb = normalizeText(b.nombre);
  if (!(na === nb || na.includes(nb) || nb.includes(na))) return false;
  const diffDays = Math.abs(new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()) / 86_400_000;
  if (diffDays > 1) return false;
  if (a.ciudad && b.ciudad) {
    const ca = normalizeText(a.ciudad);
    const cb = normalizeText(b.ciudad);
    if (!(ca.includes(cb) || cb.includes(ca))) return false;
  }
  return true;
}

// ---------- Pipeline completo ----------

export function buildPreview(csvText: string, existing: ExistingFestival[]): ParseResult {
  const { records, lines } = parseCsv(csvText);

  // Descarta filas totalmente vacías (ej. la primera línea ",,,,,," de la
  // hoja real), conservando el número de línea original para los reportes.
  const nonEmpty: { cells: string[]; line: number }[] = [];
  records.forEach((cells, i) => {
    if (cells.some((c) => c.trim() !== '')) nonEmpty.push({ cells, line: lines[i] });
  });
  if (nonEmpty.length === 0) return { ok: false, error: 'El archivo está vacío.' };

  const resolved = resolveColumns(nonEmpty[0].cells);
  if ('error' in resolved) return { ok: false, error: resolved.error };
  const dataRows = resolved.consumesHeader ? nonEmpty.slice(1) : nonEmpty;
  if (dataRows.length === 0) return { ok: false, error: 'El archivo solo tiene encabezados, sin filas de datos.' };

  const existingIds = new Map(existing.map((f) => [f.id, f]));
  const seenInFile: { nombre: string; ciudad: string; fecha_inicio: string }[] = [];
  const hasIdColumn = resolved.map.includes('id');

  const rows: PreviewRow[] = dataRows.map(({ cells, line }) => {
    const values: Partial<Record<Field, string>> = {};
    resolved.map.forEach((field, idx) => {
      if (field) values[field] = cells[idx] ?? '';
    });

    const validated = validateRow(values);
    if ('errors' in validated) {
      return { line, raw: cells, status: 'error', messages: validated.errors };
    }
    const row = validated.row;

    // 1) mismo id que un evento existente
    const idValue = (values.id ?? '').trim();
    const byId = idValue ? existingIds.get(idValue) : undefined;
    if (byId) {
      return {
        line,
        raw: cells,
        status: byId.estado_evento === 'archivado' ? 'duplicado_archivado' : 'duplicado_activo',
        messages: [`Ya existe un evento con ese mismo id: "${byId.nombre}".`],
        row,
      };
    }

    // 2) repetido dentro del propio archivo
    if (seenInFile.some((s) => sameEvent(s, row))) {
      return { line, raw: cells, status: 'duplicado_en_archivo', messages: ['Repetido más arriba en este mismo archivo.'], row };
    }
    seenInFile.push(row);

    // 3) mismo evento (nombre + fecha ±1 día + ciudad) en el catálogo
    const same = existing.find((f) => sameEvent(f, row));
    if (same) {
      const archived = same.estado_evento === 'archivado';
      return {
        line,
        raw: cells,
        status: archived ? 'duplicado_archivado' : 'duplicado_activo',
        messages: [
          `Ya existe ${archived ? 'un evento archivado' : 'un evento activo'} igual: "${same.nombre}" (${same.fecha_inicio}, ${same.ciudad}).`,
        ],
        row,
      };
    }

    // 4) mismo nombre que un evento archivado, otra fecha = probable re-anuncio
    const normName = normalizeText(row.nombre);
    const reannounce = existing.find((f) => f.estado_evento === 'archivado' && normalizeText(f.nombre) === normName);
    if (reannounce) {
      return {
        line,
        raw: cells,
        status: 'reanuncio_archivado',
        messages: [`Ya hubo un evento archivado con este nombre (${reannounce.fecha_inicio}) — probable re-anuncio.`],
        row,
      };
    }

    return { line, raw: cells, status: 'ok', messages: [], row };
  });

  return { ok: true, rows, usedHeaderless: resolved.headerless, ignoredIdColumn: hasIdColumn };
}

export function summarize(rows: PreviewRow[]): Record<RowStatus, number> {
  const s: Record<RowStatus, number> = {
    ok: 0,
    reanuncio_archivado: 0,
    duplicado_activo: 0,
    duplicado_archivado: 0,
    duplicado_en_archivo: 0,
    error: 0,
  };
  for (const r of rows) s[r.status]++;
  return s;
}

// Filas que se marcan para importar por default: las que no son duplicado ni
// error (los re-anuncios son eventos nuevos legítimos).
export function defaultSelected(r: PreviewRow): boolean {
  return r.status === 'ok' || r.status === 'reanuncio_archivado';
}
