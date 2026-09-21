import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { CsvImport } from './csv-import';

export default async function ImportarCsvPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Importar eventos desde CSV</h1>
        <Link href="/admin" className="text-sm underline">
          ← Festivales
        </Link>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        Vía rápida para cuando ya tienes una lista armada en una hoja de cálculo. Los eventos se crean directo en el
        catálogo (no pasan por candidatos), y se marcan los posibles duplicados contra el catálogo activo y el
        historial archivado antes de guardar nada.
      </p>
      <CsvImport />
    </main>
  );
}
