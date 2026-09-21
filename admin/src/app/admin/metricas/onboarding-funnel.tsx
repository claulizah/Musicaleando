import { buildFunnel, MIN_USUARIOS_PARA_CONCLUIR } from '@/lib/onboardingFunnel';

export type FunnelData = {
  usuarios: number;
  primer_registro: string | null;
  en_curso: number;
  pasos: { paso: number; nombre: string | null; llegaron: number }[];
};

const fmtPct = (n: number | null) => (n === null ? '—' : `${n}%`);

// Embudo de abandono del onboarding: por paso, cuántos llegaron y cuántos se
// quedaron ahí (llegaron a ese paso y no al siguiente). Un paso que se salta
// (solo "Ubicación" es opcional) NO cuenta como abandono: quien toca "Saltar"
// llega a "Onboarding completo". Abandono = cerrar la app sin pasar al
// siguiente paso.
export function OnboardingFunnel({ data, error }: { data: FunnelData | null; error?: string }) {
  if (error || !data) {
    return (
      <section className="mb-8">
        <h2 className="mb-2 font-medium">Embudo de onboarding</h2>
        <p className="text-sm text-red-600">
          No se pudo cargar el embudo{error ? `: ${error}` : ''}. Si es la primera vez, falta correr la migración{' '}
          <code>onboarding_progress</code>.
        </p>
      </section>
    );
  }

  const funnel = buildFunnel(data.pasos);
  const culpable = funnel.pasoMasAbandono;

  return (
    <section className="mb-8">
      <h2 className="mb-2 font-medium">Embudo de onboarding</h2>

      {data.usuarios === 0 ? (
        <p className="text-sm text-gray-500">
          Todavía no hay datos: el registro empieza con la versión de la app que lo incluye, y cada usuario aparece
          cuando la abre. Los usuarios que ya tenían el perfil hecho no cuentan aquí.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-600">
            {funnel.empezaron} usuario{funnel.empezaron === 1 ? '' : 's'} con seguimiento
            {data.primer_registro ? ` desde el ${data.primer_registro.slice(0, 10)}` : ''} ·{' '}
            {funnel.completaron} completaron ({fmtPct(funnel.pctCompletaron)})
            {data.en_curso > 0 && ` · ${data.en_curso} avanzando ahora mismo (aún no cuentan como abandono)`}
          </p>
          {funnel.pocoVolumen && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Todavía son pocos usuarios (menos de {MIN_USUARIOS_PARA_CONCLUIR}): un solo usuario que cierra la app
              mueve un paso varios puntos. Úsalo como pista, no como conclusión.
            </p>
          )}
          {culpable && (
            <p className="mb-3 text-sm">
              Donde más gente se queda: <b>{culpable.etiqueta}</b> ({culpable.seFueronAqui} de {culpable.llegaron} que
              llegaron, {fmtPct(culpable.pctAbandonoAqui)}).
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-1 pr-3 font-medium">Paso</th>
                  <th className="py-1 pr-3 text-right font-medium">Llegaron</th>
                  <th className="py-1 pr-3 text-right font-medium">% del inicio</th>
                  <th className="py-1 pr-3 text-right font-medium">Se quedaron aquí</th>
                  <th className="py-1 text-right font-medium">% que se queda aquí</th>
                </tr>
              </thead>
              <tbody>
                {funnel.rows.map((r) => {
                  const esCulpable = culpable?.paso === r.paso;
                  return (
                    <tr key={r.paso} className={`border-b border-gray-100 ${esCulpable ? 'bg-red-50 font-medium' : ''}`}>
                      <td className="py-1 pr-3">
                        {r.paso}. {r.etiqueta}
                      </td>
                      <td className="py-1 pr-3 text-right">{r.llegaron}</td>
                      <td className="py-1 pr-3 text-right">{fmtPct(r.pctDelInicio)}</td>
                      <td className="py-1 pr-3 text-right">{r.seFueronAqui ?? '—'}</td>
                      <td className="py-1 text-right">{fmtPct(r.pctAbandonoAqui)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            &quot;Se quedaron aquí&quot; = llegaron a ese paso y no al siguiente. El paso de Ubicación es opcional:
            quien toca &quot;Saltar&quot; cuenta como que avanzó (llega a &quot;Onboarding completo&quot;), no como
            abandono.
          </p>
        </>
      )}
    </section>
  );
}
