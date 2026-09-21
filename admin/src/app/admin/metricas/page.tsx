import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { OnboardingFunnel, type FunnelData } from './onboarding-funnel';

type Metrics = {
  generado_en: string;
  usuarios: {
    total: number;
    con_perfil_musical: number;
    con_ciudad: number;
    registros_por_semana: { semana: string; n: number }[];
  };
  activos: {
    hoy: number;
    ultimos_7d: number;
    ultimos_30d: number;
    por_dia: { dia: string; n: number }[];
    por_semana: { semana: string; n: number }[];
  };
  uso: {
    squads_creados: number;
    squads_creados_7d: number;
    membresias_squad: number;
    shares_trends: number;
    shares_trends_7d: number;
    moods_registrados: number;
    eventos_con_interes: number;
    marcas_de_interes: number;
    comentarios: number;
    clics_compra: number;
    clics_compra_7d: number;
    usuarios_con_mi_horario: number | null;
  };
  generos: { genero: string; n: number }[];
  ciudades: { ciudad: string; n: number }[];
};

const GENERO_LABEL: Record<string, string> = {
  rock: 'Rock',
  electronica: 'Electrónica',
  pop: 'Pop',
  latin: 'Reggaetón / Latin',
  indie: 'Indie / Alternativo',
  lofi: 'Chill / Lo-fi',
  jazz: 'Jazz / Soul',
  metal: 'Metal',
};

const fmtDay = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

function Stat({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function Bars({ rows, labelOf }: { rows: { key: string; n: number }[]; labelOf?: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-gray-500">{labelOf ? labelOf(r.key) : r.key}</span>
          <div className="h-3 flex-1 rounded bg-gray-100">
            <div className="h-3 rounded bg-black" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right text-gray-700">{r.n}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function MetricasPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_metrics');
  const m = data as Metrics | null;
  // El embudo viene de su propia función: si su migración aún no se corre, solo
  // esa sección avisa, el resto del panel sigue funcionando.
  const { data: funnelRaw, error: funnelError } = await supabase.rpc('admin_onboarding_funnel');

  if (error || !m) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold">Métricas</h1>
        <p className="mt-3 text-sm text-red-600">
          No se pudieron cargar las métricas{error ? `: ${error.message}` : ''}. Si es la primera vez, falta correr
          la migración <code>novedades_y_metricas</code>.
        </p>
      </main>
    );
  }

  const pctPerfil = m.usuarios.total ? Math.round((m.usuarios.con_perfil_musical / m.usuarios.total) * 100) : 0;
  const pctCiudad = m.usuarios.total ? Math.round((m.usuarios.con_ciudad / m.usuarios.total) * 100) : 0;
  const ciudadesConDato = m.ciudades.filter((c) => c.ciudad !== '(sin ciudad)');

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Métricas</h1>
        <Link href="/admin" className="text-sm underline">
          ← Festivales
        </Link>
      </div>
      <p className="mb-6 text-xs text-gray-500">
        Un &quot;usuario activo&quot; es quien hizo al menos una acción registrada (mood, marcar interés, compartir,
        comentar, squad, contacto, reseña, álbum, clic de compra o guardar perfil). La app no registra aperturas, así
        que quien solo mira no cuenta: es un piso, no el total. Días y semanas en hora de México; no incluye
        identidades de cuentas borradas.
      </p>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Usuarios</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={m.usuarios.total} label="usuarios" />
          <Stat value={m.activos.ultimos_7d} label="activos, últimos 7 días" />
          <Stat value={m.activos.ultimos_30d} label="activos, últimos 30 días" />
          <Stat value={m.activos.hoy} label="activos hoy" />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Activos por día (últimos 14)</p>
            <Bars rows={m.activos.por_dia.map((r) => ({ key: r.dia, n: r.n }))} labelOf={fmtDay} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Activos por semana (desde el lunes)</p>
            <Bars rows={m.activos.por_semana.map((r) => ({ key: r.semana, n: r.n }))} labelOf={fmtDay} />
            <p className="mb-1 mt-4 text-xs font-medium text-gray-600">Registros nuevos por semana</p>
            <Bars rows={m.usuarios.registros_por_semana.map((r) => ({ key: r.semana, n: r.n }))} labelOf={fmtDay} />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Perfil completo (embudo de onboarding)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={`${pctPerfil}%`} label="completó el perfil musical" hint={`${m.usuarios.con_perfil_musical} de ${m.usuarios.total}`} />
          <Stat value={`${pctCiudad}%`} label="tiene estado" hint={`${m.usuarios.con_ciudad} de ${m.usuarios.total}`} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Uso por función</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat value={m.uso.squads_creados} label="squads creados" hint={`${m.uso.squads_creados_7d} en 7 días · ${m.uso.membresias_squad} membresías`} />
          <Stat value={m.uso.shares_trends} label="canciones compartidas en Trends" hint={`${m.uso.shares_trends_7d} en 7 días`} />
          <Stat value={m.uso.clics_compra} label='clics en "Comprar boletos"' hint={`${m.uso.clics_compra_7d} en 7 días`} />
          <Stat value={m.uso.moods_registrados} label="moods registrados" />
          <Stat value={m.uso.marcas_de_interes} label="marcas Voy / Tal vez" hint={`en ${m.uso.eventos_con_interes} evento(s)`} />
          <Stat value={m.uso.comentarios} label="comentarios en eventos" />
          <Stat
            value={m.uso.usuarios_con_mi_horario ?? '—'}
            label='usuarios con "Mi horario"'
            hint={m.uso.usuarios_con_mi_horario === null ? 'todavía no existe la función' : undefined}
          />
        </div>
      </section>

      <OnboardingFunnel data={funnelRaw as FunnelData | null} error={funnelError?.message} />

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 font-medium">Géneros más comunes (perfiles)</h2>
          {m.generos.length === 0 ? (
            <p className="text-sm text-gray-500">Todavía no hay perfiles.</p>
          ) : (
            <Bars rows={m.generos.map((g) => ({ key: g.genero, n: g.n }))} labelOf={(k) => GENERO_LABEL[k] ?? k} />
          )}
        </section>
        <section>
          <h2 className="mb-2 font-medium">Estados</h2>
          {ciudadesConDato.length === 0 ? (
            <p className="text-sm text-gray-500">
              Ningún usuario ha elegido su estado todavía ({m.usuarios.total} sin estado). Se pide en el
              onboarding (opcional) y se puede cambiar en Perfil.
            </p>
          ) : (
            <Bars rows={ciudadesConDato.map((c) => ({ key: c.ciudad, n: c.n }))} />
          )}
        </section>
      </div>
    </main>
  );
}
