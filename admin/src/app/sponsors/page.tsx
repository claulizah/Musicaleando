import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { NewSponsorForm } from './new-sponsor-form';
import { DeleteSponsorButton } from './delete-sponsor-button';

export default async function SponsorsPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: sponsors } = await supabase
    .from('sponsors')
    .select('id, nombre, contacto, ofrece')
    .order('nombre');

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Patrocinadores</h1>
        <Link href="/admin" className="text-sm underline">
          ← Festivales
        </Link>
      </div>

      <ul className="mb-6 flex flex-col gap-3">
        {sponsors?.map((s) => (
          <li
            key={s.id}
            className="flex items-start justify-between rounded-lg border border-gray-200 bg-white p-4"
          >
            <div>
              <p className="font-medium">{s.nombre}</p>
              {s.ofrece && <p className="text-sm text-gray-500">{s.ofrece}</p>}
              {s.contacto && <p className="text-xs text-gray-400">{s.contacto}</p>}
            </div>
            <DeleteSponsorButton sponsorId={s.id} />
          </li>
        ))}
        {sponsors?.length === 0 && (
          <p className="text-sm text-gray-500">No hay patrocinadores todavía.</p>
        )}
      </ul>

      <NewSponsorForm />
    </main>
  );
}
