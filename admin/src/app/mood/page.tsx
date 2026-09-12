import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { CandidateActions } from './candidate-actions';
import { AddManualForm } from './add-manual-form';
import { SyncButton } from './sync-button';

// Suggested Last.fm tag per mood — a starting point in the sync form, not a
// hardcoded requirement: the curator can type any other tag. "workout"
// rendered poorly for Activo when tested (obscure/irrelevant tracks); "gym"
// tested much better, so that's the default here instead. See ESTADO.md for
// the full per-tag quality notes from testing this against the real API.
const SUGGESTED_TAG: Record<string, string> = {
  feliz: 'happy',
  triste: 'sad',
  fiestero: 'party',
  relajado: 'chill',
  activo: 'gym',
  peda: 'drinking',
};

export default async function MoodPage() {
  const admin = await requireAdmin();
  if (!admin.authorized) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: moods }, { data: playlists }] = await Promise.all([
    supabase.from('mood_catalog').select('id, label, emoji').order('orden'),
    supabase
      .from('mood_playlists')
      .select('id, mood_id, titulo, artista, genero, fuente, estado, created_at')
      .order('created_at', { ascending: true }),
  ]);

  const pendingByMood = new Map<string, typeof playlists>();
  const approvedCountByMood = new Map<string, number>();
  for (const row of playlists ?? []) {
    if (row.estado === 'pendiente') {
      const list = pendingByMood.get(row.mood_id) ?? [];
      list.push(row);
      pendingByMood.set(row.mood_id, list);
    } else {
      approvedCountByMood.set(row.mood_id, (approvedCountByMood.get(row.mood_id) ?? 0) + 1);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Mood playlists</h1>
      <p className="mt-1 text-sm text-gray-500">
        Bandeja de candidatos por mood-actividad (manual o Last.fm). Nada aparece en la app hasta
        que se aprueba aquí.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {(moods ?? []).map((mood) => {
          const pending = pendingByMood.get(mood.id) ?? [];
          const approvedCount = approvedCountByMood.get(mood.id) ?? 0;
          return (
            <section key={mood.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  {mood.emoji} {mood.label}{' '}
                  <span className="font-normal text-gray-400">
                    · {approvedCount} aprobada{approvedCount === 1 ? '' : 's'}
                  </span>
                </h2>
                <SyncButton moodId={mood.id} suggestedTag={SUGGESTED_TAG[mood.id] ?? ''} />
              </div>

              {approvedCount === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  Sin canciones aprobadas todavía — la app cae al fallback genérico por perfil
                  musical para este mood.
                </p>
              )}

              <ul className="mt-3 flex flex-col gap-2">
                {pending.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 p-2 text-sm"
                  >
                    <div>
                      <p>
                        {row.titulo} — {row.artista}
                      </p>
                      <p className="text-xs text-gray-400">
                        fuente: {row.fuente}
                        {row.genero ? ` · género: ${row.genero}` : ''}
                      </p>
                    </div>
                    <CandidateActions id={row.id} />
                  </li>
                ))}
                {pending.length === 0 && (
                  <p className="text-xs text-gray-400">Sin candidatos pendientes.</p>
                )}
              </ul>
            </section>
          );
        })}
        {(moods ?? []).length === 0 && (
          <p className="text-sm text-gray-500">No hay moods en el catálogo todavía.</p>
        )}
      </div>

      <div className="mt-8">
        <AddManualForm moods={(moods ?? []).map((m) => ({ id: m.id, label: `${m.emoji} ${m.label}` }))} />
      </div>
    </main>
  );
}
