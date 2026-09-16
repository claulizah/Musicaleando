import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { cleanEventNameSafe, hasDanglingQuote, hasGluedCitySuffix, hasGluedAnniversarySuffix } from '@/lib/cleanEventName';
import { CleanupReview } from './cleanup-review';

// Pase único de limpieza sobre el catálogo YA APROBADO (festivals) — nunca
// sobre event_candidates, que se limpian individualmente al aprobarse (ver
// candidatos-list.tsx). Solo transformaciones deterministas y seguras
// (espacios, guiones repetidos, comillas que envuelven el nombre completo);
// nada de re-casing ni separar ciudad/año/gira del nombre — eso queda
// reportado como hallazgo, no aplicado. Ver
// prompt-siguiente-normalizar-nombres-bulk-aprobar.md.
export default async function LimpiezaNombresPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: festivals } = await supabase.from('festivals').select('id, nombre').order('nombre');

  const rows = (festivals ?? []).map((f) => ({
    id: f.id,
    before: f.nombre,
    after: cleanEventNameSafe(f.nombre),
  }));
  const changed = rows.filter((r) => r.before !== r.after);

  const flaggedQuotes = (festivals ?? []).filter((f) => hasDanglingQuote(f.nombre));
  const flaggedCity = (festivals ?? []).filter((f) => hasGluedCitySuffix(f.nombre));
  const flaggedAnniversary = (festivals ?? []).filter((f) => hasGluedAnniversarySuffix(f.nombre));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Limpieza de nombres — catálogo aprobado</h1>
          <p className="mt-1 text-sm text-gray-500">
            Solo espacios/guiones/comillas obvias. Nada de mayúsculas/minúsculas ni separar ciudad o año — eso
            se reporta abajo, no se toca solo.
          </p>
        </div>
        <Link href="/candidatos" className="text-sm underline">
          ← Candidatos
        </Link>
      </div>

      <CleanupReview rows={changed} />

      {(flaggedQuotes.length > 0 || flaggedCity.length > 0 || flaggedAnniversary.length > 0) && (
        <div className="mt-10 flex flex-col gap-6">
          <h2 className="text-sm font-medium text-gray-700">
            Hallazgos que necesitan tu criterio (no se tocan automáticamente)
          </h2>

          {flaggedQuotes.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600">
                Comilla suelta en un solo extremo ({flaggedQuotes.length}) — podría ser parte real del título:
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-500">
                {flaggedQuotes.map((f) => (
                  <li key={f.id}>{f.nombre}</li>
                ))}
              </ul>
            </div>
          )}

          {flaggedCity.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600">
                Posible ciudad pegada al nombre ({flaggedCity.length}) — candidato a un ticket futuro de
                separación nombre/ciudad, fuera de alcance aquí:
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-500">
                {flaggedCity.map((f) => (
                  <li key={f.id}>{f.nombre}</li>
                ))}
              </ul>
            </div>
          )}

          {flaggedAnniversary.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600">
                Posible aniversario/gira pegado al nombre ({flaggedAnniversary.length}) — mismo caso, futuro
                ticket:
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-gray-500">
                {flaggedAnniversary.map((f) => (
                  <li key={f.id}>{f.nombre}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
