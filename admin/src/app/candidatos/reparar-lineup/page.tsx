import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { getRepairPreview } from './actions';
import { RepairPreview } from './repair-preview';

// Reparación puntual de los 13 festivales identificados en
// prompt-siguiente-fix-hora-lineup-y-bulk-logging.md que quedaron aprobados
// sin ninguna fila en festival_lineup por el bug de hora inválida (ya
// corregido). Ver prompt-siguiente-reparar-lineup-13-festivales.md — no toca
// ningún otro festival.
export default async function RepararLineupPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const { error, items } = await getRepairPreview();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Reparar line-up de 13 festivales</h1>
          <p className="mt-1 text-sm text-gray-500">
            Toma el line-up que ya estaba guardado en el candidato original de cada uno y lo inserta en
            festival_lineup (con la hora corregida y vinculado a la tabla artists). No toca ningún otro festival.
          </p>
        </div>
        <Link href="/candidatos" className="text-sm underline">
          ← Candidatos
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">Error: {error}</p>}
      {items && <RepairPreview items={items} />}
    </main>
  );
}
